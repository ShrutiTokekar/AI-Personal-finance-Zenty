"""Password hashing, sessions, CSRF, encryption and rate limiting."""
import hashlib
import hmac
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import AuthSession, RateLimit, User, utcnow

settings = get_settings()

# Over HTTPS, the "__Host-" prefix makes browsers refuse these cookies unless they are
# Secure, host-only and path=/, which blocks subdomain cookie tossing.
_PREFIX = "__Host-" if settings.cookie_secure else ""
SESSION_COOKIE = f"{_PREFIX}zenty_session"
CSRF_COOKIE = f"{_PREFIX}zenty_csrf"
SESSION_TOUCH_SECONDS = 60  # how often last-seen is written while active
CSRF_HEADER = "x-csrf-token"

_hasher = PasswordHasher()  # Argon2id with library-recommended parameters
# A real hash used to equalise timing when the email doesn't exist.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))


# ---------- passwords ----------

def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, InvalidHashError):
        return False


def password_problems(password: str, email: str = "") -> str | None:
    if len(password) < 10:
        return "Password must be at least 10 characters."
    if len(password) > 128:
        return "Password is too long."
    local = email.split("@")[0].lower() if email else ""
    if len(local) >= 4 and local in password.lower():
        return "Password must not contain your email name."
    classes = sum([
        any(c.islower() for c in password),
        any(c.isupper() for c in password),
        any(c.isdigit() for c in password),
        any(not c.isalnum() for c in password),
    ])
    if classes < 3:
        return "Use at least three of: lowercase, uppercase, numbers, symbols."
    return None


# ---------- one-time tokens ----------

def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---------- encryption of bank tokens ----------

def _fernet() -> Fernet:
    if not settings.encryption_key:
        raise HTTPException(503, "Bank linking is not configured on this server.")
    return Fernet(settings.encryption_key.encode())


def encrypt(value: str) -> bytes:
    return _fernet().encrypt(value.encode())


def encrypt_text(value: str) -> str:
    """Encrypt a short text field (e.g. phone number). Falls back to plaintext only
    when no key is configured, which production refuses to start without."""
    if not settings.encryption_key:
        return value
    return _fernet().encrypt(value.encode()).decode()


def decrypt_text(value: str) -> str:
    if value.startswith("gAAAA") and settings.encryption_key:
        try:
            return _fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            return ""
    return value


def decrypt(value: bytes) -> str:
    try:
        return _fernet().decrypt(value).decode()
    except InvalidToken as exc:  # wrong key or tampered data
        raise HTTPException(500, "Could not decrypt bank credentials.") from exc


# ---------- sessions ----------

def _cookie_kwargs():
    return dict(secure=settings.cookie_secure, samesite="strict", path="/")


def start_session(db: Session, user: User, request: Request, response: Response) -> None:
    token = new_token()
    now = utcnow()
    db.add(AuthSession(
        token_hash=token_hash(token),
        user_id=user.id,
        expires_at=now + timedelta(hours=settings.session_max_hours),
        last_seen_at=now,
        user_agent=(request.headers.get("user-agent") or "")[:255],
    ))
    db.commit()
    max_age = settings.session_max_hours * 3600
    response.set_cookie(SESSION_COOKIE, token, httponly=True, max_age=max_age, **_cookie_kwargs())
    # CSRF token is readable by our own JS (not httpOnly) and must be echoed back in a header.
    response.set_cookie(CSRF_COOKIE, new_token(), httponly=False, max_age=max_age, **_cookie_kwargs())


def end_session(db: Session, request: Request, response: Response) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db.query(AuthSession).filter(AuthSession.token_hash == token_hash(token)).delete()
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def end_all_sessions(db: Session, user_id: int) -> None:
    db.query(AuthSession).filter(AuthSession.user_id == user_id).delete()
    db.commit()


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(401, "Not signed in.")
    sess = db.query(AuthSession).filter(AuthSession.token_hash == token_hash(token)).first()
    now = utcnow()
    if not sess or sess.expires_at < now:
        if sess:
            db.delete(sess)
            db.commit()
        raise HTTPException(401, "Session expired. Please sign in again.")
    idle = timedelta(minutes=settings.session_idle_minutes)
    if sess.last_seen_at and now - sess.last_seen_at > idle:
        db.delete(sess)
        db.commit()
        raise HTTPException(401, f"For your security, you were signed out after {settings.session_idle_minutes} minutes of inactivity.")
    if not sess.last_seen_at or (now - sess.last_seen_at).total_seconds() > SESSION_TOUCH_SECONDS:
        sess.last_seen_at = now
        db.commit()
    user = db.get(User, sess.user_id)
    if not user:
        raise HTTPException(401, "Not signed in.")
    return user


def verified_user(user: User = Depends(current_user)) -> User:
    if not user.email_verified:
        raise HTTPException(403, "Please verify your email address first.")
    return user


def csrf_ok(request: Request) -> bool:
    """Double-submit check: header must match the CSRF cookie."""
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    return bool(cookie and header and hmac.compare_digest(cookie, header))


# ---------- rate limiting ----------

def client_ip(request: Request) -> str:
    # Vercel sets x-forwarded-for; the first entry is the real client.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(db: Session, key: str, limit: int, window_seconds: int) -> None:
    now = utcnow()
    row = db.get(RateLimit, key)
    if row is None or (now - row.window_start).total_seconds() > window_seconds:
        if row is None:
            row = RateLimit(key=key, window_start=now, count=0)
            db.add(row)
        row.window_start = now
        row.count = 0
    row.count += 1
    db.commit()
    if row.count > limit:
        raise HTTPException(429, "Too many attempts. Please wait a few minutes and try again.")


# ---------- security activity ----------

def device_label(request: Request | None) -> str:
    ua = (request.headers.get("user-agent") if request else "") or ""
    os_ = ("iPhone/iPad" if any(k in ua for k in ("iPhone", "iPad")) else "Android" if "Android" in ua
           else "Mac" if "Mac OS X" in ua else "Windows" if "Windows" in ua else "Linux" if "Linux" in ua else "Unknown device")
    br = ("Edge" if "Edg/" in ua else "Chrome" if "Chrome/" in ua else "Safari" if "Safari/" in ua
          else "Firefox" if "Firefox/" in ua else "Browser")
    return f"{br} on {os_}"


def record_event(db: Session, user: User, kind: str, request: Request | None = None) -> bool:
    """Log a security event. Returns True if this device hasn't signed in before."""
    from .models import SecurityEvent
    device = device_label(request)
    new_device = False
    if kind == "login":
        seen = db.query(SecurityEvent).filter(SecurityEvent.user_id == user.id, SecurityEvent.kind == "login",
                                              SecurityEvent.device == device).first()
        any_login = db.query(SecurityEvent).filter(SecurityEvent.user_id == user.id, SecurityEvent.kind == "login").first()
        new_device = seen is None and any_login is not None
    db.add(SecurityEvent(user_id=user.id, kind=kind, device=device))
    db.commit()
    return new_device
