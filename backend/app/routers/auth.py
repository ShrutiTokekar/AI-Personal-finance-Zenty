"""Sign up, sign in (email or Google), email verification, password reset."""
from datetime import timedelta

import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

import json
from typing import Literal

from .. import emails, sms, totp
from ..config import get_settings
from ..db import get_db
from ..models import User, utcnow
from ..security import (
    client_ip,
    current_user,
    decrypt_text,
    device_label,
    end_all_sessions,
    record_event,
    end_session,
    hash_password,
    new_token,
    password_problems,
    rate_limit,
    start_session,
    token_hash,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

MAX_FAILED = 5
LOCK_MINUTES = 15
GENERIC_LOGIN_ERROR = "Incorrect email or password."

_google_jwks = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs", cache_keys=True)


class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    confirm_password: str = Field(min_length=1, max_length=128)
    phone: str | None = Field(default=None, max_length=24)  # optional


class CodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class MfaIn(BaseModel):
    ticket: str = Field(min_length=20, max_length=200)
    code: str = Field(min_length=6, max_length=12)
    method: Literal["totp", "email", "backup", "sms"] | None = None


class TicketIn(BaseModel):
    ticket: str = Field(min_length=20, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleIn(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)


class TokenIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class EmailIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=1, max_length=128)


def _norm(email: str) -> str:
    return email.strip().lower()


def _issue_verify(user: User) -> str:
    token = new_token()
    user.verify_token_hash = token_hash(token)
    user.verify_expires = utcnow() + timedelta(hours=48)
    # Token goes in the URL fragment (#), which browsers never send to servers or logs.
    return f"{settings.app_url}/#verify={token}"


@router.post("/signup")
def signup(body: SignupIn, request: Request, response: Response, bg: BackgroundTasks, db: Session = Depends(get_db)):
    rate_limit(db, f"signup:{client_ip(request)}", limit=5, window_seconds=3600)
    email = _norm(body.email)
    if body.password != body.confirm_password:
        raise HTTPException(400, "Passwords don't match.")
    problem = password_problems(body.password, email)
    if problem:
        raise HTTPException(400, problem)
    phone = sms.normalize_phone(body.phone) if body.phone and body.phone.strip() else None
    if db.query(User).filter(User.email == email).first():
        # Don't reveal too much, but the user needs to know to sign in instead.
        raise HTTPException(409, "An account with this email already exists. Try signing in.")

    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password),
                phone=phone, mfa_enabled=bool(settings.sms_enabled and phone))
    db.add(user)
    db.flush()
    verify_url = _issue_verify(user)
    code_sent = sms.issue_code(user, "verification") if (settings.sms_enabled and phone) else False
    db.commit()

    bg.add_task(emails.send_welcome, user.email, user.name, verify_url)
    record_event(db, user, "signup", request)
    record_event(db, user, "login", request)
    start_session(db, user, request, response)
    return {"user": user.public(), "phone_verification_required": code_sent}


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, bg: BackgroundTasks, db: Session = Depends(get_db)):
    ip = client_ip(request)
    email = _norm(body.email)
    rate_limit(db, f"login-ip:{ip}", limit=20, window_seconds=900)
    rate_limit(db, f"login-email:{email}", limit=10, window_seconds=900)

    user = db.query(User).filter(User.email == email).first()
    if user and user.locked_until and user.locked_until > utcnow():
        raise HTTPException(429, "Too many failed attempts. Try again in a few minutes or reset your password.")

    if not user or not verify_password(body.password, user.password_hash):
        if user:
            record_event(db, user, "login_failed", request)
            user.failed_logins += 1
            if user.failed_logins >= MAX_FAILED:
                user.locked_until = utcnow() + timedelta(minutes=LOCK_MINUTES)
                user.failed_logins = 0
            db.commit()
        raise HTTPException(401, GENERIC_LOGIN_ERROR)

    user.failed_logins = 0
    user.locked_until = None
    methods: list[str] = []
    if user.totp_enabled and user.totp_secret_enc:
        methods = ["totp", "email"] + (["backup"] if user.backup_codes else [])
    elif user.mfa_enabled and user.phone and settings.sms_enabled:
        methods = ["sms"]
    if methods:
        # Password was right; now require a second factor before any session exists.
        ticket = new_token()
        user.mfa_ticket_hash = token_hash(ticket)
        user.sms_code_attempts = 0
        if methods == ["sms"]:
            rate_limit(db, f"sms:{user.id}", limit=5, window_seconds=900)
            if not sms.issue_code(user, "sign-in"):
                db.commit()
                raise HTTPException(502, "We couldn't text your sign-in code. Please try again in a minute.")
        db.commit()
        return {"mfa_required": True, "mfa_ticket": ticket, "methods": methods, "phone_masked": user.public()["phone_masked"]}
    db.commit()
    _signed_in(db, user, request, bg)
    start_session(db, user, request, response)
    return {"user": user.public()}


def _signed_in(db: Session, user: User, request: Request, bg: BackgroundTasks) -> None:
    """Log the sign-in and email the owner if it's from a device we haven't seen."""
    if record_event(db, user, "login", request):
        bg.add_task(emails.send_security_alert, user.email, user.name, "New sign-in",
                    "Your Zenty account was just signed in to from a new device.", device_label(request))


def _user_for_ticket(db: Session, ticket: str) -> User:
    user = db.query(User).filter(User.mfa_ticket_hash == token_hash(ticket)).first()
    if not user:
        raise HTTPException(400, "This sign-in attempt has expired. Please sign in again.")
    return user


@router.post("/mfa/verify")
def mfa_verify(body: MfaIn, request: Request, response: Response, bg: BackgroundTasks, db: Session = Depends(get_db)):
    rate_limit(db, f"mfa-ip:{client_ip(request)}", limit=20, window_seconds=900)
    user = _user_for_ticket(db, body.ticket)
    used_backup = False
    method = body.method or ("totp" if user.totp_enabled else "sms")
    body = body.model_copy(update={"method": method})
    if body.method in ("email", "sms"):
        try:
            sms.check_code(user, body.code)
        finally:
            db.commit()  # persist the attempt counter even when the code is wrong
    else:
        if user.sms_code_attempts >= sms.MAX_ATTEMPTS:
            user.mfa_ticket_hash = None
            db.commit()
            raise HTTPException(429, "Too many wrong codes. Please sign in again.")
        ok = False
        if body.method == "totp" and user.totp_enabled and user.totp_secret_enc:
            step = totp.verify(decrypt_text(user.totp_secret_enc), body.code, user.totp_last_step)
            if step is not None:
                user.totp_last_step = step
                ok = True
        elif body.method == "backup" and user.backup_codes:
            hashes = json.loads(user.backup_codes)
            h = token_hash(totp.normalize_backup(body.code))
            if h in hashes:
                hashes.remove(h)
                user.backup_codes = json.dumps(hashes)
                ok = used_backup = True
        if not ok:
            user.sms_code_attempts += 1
            db.commit()
            raise HTTPException(400, "That code isn't right. Check your authenticator app and try again.")
        user.sms_code_attempts = 0
    user.mfa_ticket_hash = None
    if body.method == "sms":
        user.phone_verified = True
    db.commit()
    _signed_in(db, user, request, bg)
    if used_backup:
        record_event(db, user, "backup_code_used", request)
        bg.add_task(emails.send_security_alert, user.email, user.name, "Backup code used",
                    f"A backup code was used to sign in to your Zenty account. You have {len(json.loads(user.backup_codes or '[]'))} left.",
                    device_label(request))
    start_session(db, user, request, response)
    return {"user": user.public()}


@router.post("/mfa/email")
def mfa_email(body: TicketIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    """Send a one-time sign-in code by email (backup for the authenticator app)."""
    user = _user_for_ticket(db, body.ticket)
    if not user.totp_enabled:
        raise HTTPException(400, "Email codes aren't available for this account.")
    rate_limit(db, f"mfa-email:{user.id}", limit=5, window_seconds=900)
    code = sms.make_code(user)
    db.commit()
    bg.add_task(emails.send_login_code, user.email, user.name, code)
    return {"ok": True}


@router.post("/mfa/resend")
def mfa_resend(body: TicketIn, db: Session = Depends(get_db)):
    user = _user_for_ticket(db, body.ticket)
    rate_limit(db, f"sms:{user.id}", limit=5, window_seconds=900)
    sent = sms.issue_code(user, "sign-in")
    db.commit()
    if not sent:
        raise HTTPException(502, "We couldn't text your code. Please try again in a minute.")
    return {"ok": True}


@router.post("/phone/verify")
def phone_verify(body: CodeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"phone-verify:{user.id}", limit=10, window_seconds=900)
    try:
        sms.check_code(user, body.code)
    finally:
        db.commit()
    user.phone_verified = True
    db.commit()
    return {"user": user.public()}


@router.post("/phone/resend")
def phone_resend(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not user.phone:
        raise HTTPException(400, "Add a phone number first.")
    rate_limit(db, f"sms:{user.id}", limit=5, window_seconds=900)
    if not sms.issue_code(user, "verification"):
        db.commit()
        raise HTTPException(502, "We couldn't text your code. Please try again in a minute.")
    db.commit()
    return {"ok": True}


@router.post("/google")
def google_login(body: GoogleIn, request: Request, response: Response, bg: BackgroundTasks, db: Session = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(503, "Google sign-in is not configured.")
    rate_limit(db, f"google:{client_ip(request)}", limit=20, window_seconds=900)
    try:
        key = _google_jwks.get_signing_key_from_jwt(body.credential)
        claims = jwt.decode(
            body.credential,
            key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Google sign-in failed. Please try again.") from exc
    if not claims.get("email") or not claims.get("email_verified"):
        raise HTTPException(401, "Your Google email is not verified.")

    email = _norm(claims["email"])
    sub = claims["sub"]
    user = db.query(User).filter(User.google_sub == sub).first()
    is_new = False
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_sub = sub  # link Google to the existing email account
        else:
            user = User(email=email, name=claims.get("name", "")[:120], google_sub=sub)
            db.add(user)
            is_new = True
    user.email_verified = True  # Google has verified ownership
    user.verify_token_hash = None
    db.commit()

    if is_new:
        bg.add_task(emails.send_welcome, user.email, user.name, None)
        record_event(db, user, "signup", request)
        record_event(db, user, "login", request)
    else:
        _signed_in(db, user, request, bg)
    start_session(db, user, request, response)
    return {"user": user.public(), "new_user": is_new}


@router.get("/config")
def public_config():
    """Public, non-secret settings the sign-in page needs."""
    return {
        "google_client_id": settings.google_client_id or None,
        "bank_linking": bool(settings.plaid_client_id and settings.plaid_secret),
        "sms_enabled": settings.sms_enabled,
        "session_idle_minutes": settings.session_idle_minutes,
        "email_enabled": bool(settings.resend_api_key),
    }


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    end_session(db, request, response)
    return {"ok": True}


@router.post("/logout-everywhere")
def logout_everywhere(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    record_event(db, user, "signout_all", request)
    end_all_sessions(db, user.id)
    end_session(db, request, response)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"user": user.public()}


@router.post("/verify-email")
def verify_email(body: TokenIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verify_token_hash == token_hash(body.token)).first()
    if not user or (user.verify_expires and user.verify_expires < utcnow()):
        raise HTTPException(400, "This verification link is invalid or has expired. Request a new one from the app.")
    user.email_verified = True
    user.verify_token_hash = None
    db.commit()
    return {"ok": True}


@router.post("/resend-verification")
def resend_verification(request: Request, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.email_verified:
        return {"ok": True}
    rate_limit(db, f"resend-verify:{user.id}", limit=3, window_seconds=3600)
    url = _issue_verify(user)
    db.commit()
    bg.add_task(emails.send_verification, user.email, url)
    return {"ok": True}


@router.post("/forgot-password")
def forgot_password(body: EmailIn, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db)):
    rate_limit(db, f"forgot:{client_ip(request)}", limit=5, window_seconds=3600)
    user = db.query(User).filter(User.email == _norm(body.email)).first()
    if user:
        token = new_token()
        user.reset_token_hash = token_hash(token)
        user.reset_expires = utcnow() + timedelta(hours=1)
        db.commit()
        bg.add_task(emails.send_password_reset, user.email, f"{settings.app_url}/#reset={token}")
    # Same answer whether or not the account exists (prevents email enumeration).
    return {"ok": True, "message": "If that email has an account, a reset link is on its way."}


@router.post("/reset-password")
def reset_password(body: ResetIn, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token_hash == token_hash(body.token)).first()
    if not user or not user.reset_expires or user.reset_expires < utcnow():
        raise HTTPException(400, "This reset link is invalid or has expired.")
    problem = password_problems(body.password, user.email)
    if problem:
        raise HTTPException(400, problem)
    user.password_hash = hash_password(body.password)
    user.reset_token_hash = None
    user.reset_expires = None
    user.failed_logins = 0
    user.locked_until = None
    user.email_verified = True  # they proved inbox access
    db.commit()
    end_all_sessions(db, user.id)  # sign out any attacker
    record_event(db, user, "password_reset", request)
    bg.add_task(emails.send_security_alert, user.email, user.name, "Password reset",
                "The password for your Zenty account was just reset, and all devices were signed out.", device_label(request))
    return {"ok": True}
