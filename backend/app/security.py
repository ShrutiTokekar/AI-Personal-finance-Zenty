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

SESSION_COOKIE = "zenty_session"
CSRF_COOKIE = "zenty_csrf"
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
    db.add(AuthSession(
        token_hash=token_hash(token),
        user_id=user.id,
        expires_at=utcnow() + timedelta(days=settings.session_days),
        user_agent=(request.headers.get("user-agent") or "")[:255],
    ))
    db.commit()
    max_age = settings.session_days * 86400
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
    if not sess or sess.expires_at < utcnow():
        if sess:
            db.delete(sess)
            db.commit()
        raise HTTPException(401, "Session expired. Please sign in again.")
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
