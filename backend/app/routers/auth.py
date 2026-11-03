"""Sign up, sign in (email or Google), email verification, password reset."""
from datetime import timedelta

import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from .. import emails
from ..config import get_settings
from ..db import get_db
from ..models import User, utcnow
from ..security import (
    client_ip,
    current_user,
    end_all_sessions,
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
    return f"{settings.app_url}/?verify={token}"


@router.post("/signup")
def signup(body: SignupIn, request: Request, response: Response, bg: BackgroundTasks, db: Session = Depends(get_db)):
    rate_limit(db, f"signup:{client_ip(request)}", limit=5, window_seconds=3600)
    email = _norm(body.email)
    problem = password_problems(body.password, email)
    if problem:
        raise HTTPException(400, problem)
    if db.query(User).filter(User.email == email).first():
        # Don't reveal too much, but the user needs to know to sign in instead.
        raise HTTPException(409, "An account with this email already exists. Try signing in.")

    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    verify_url = _issue_verify(user)
    db.commit()

    bg.add_task(emails.send_welcome, user.email, user.name, verify_url)
    start_session(db, user, request, response)
    return {"user": user.public()}


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = client_ip(request)
    email = _norm(body.email)
    rate_limit(db, f"login-ip:{ip}", limit=20, window_seconds=900)
    rate_limit(db, f"login-email:{email}", limit=10, window_seconds=900)

    user = db.query(User).filter(User.email == email).first()
    if user and user.locked_until and user.locked_until > utcnow():
        raise HTTPException(429, "Too many failed attempts. Try again in a few minutes or reset your password.")

    if not user or not verify_password(body.password, user.password_hash):
        if user:
            user.failed_logins += 1
            if user.failed_logins >= MAX_FAILED:
                user.locked_until = utcnow() + timedelta(minutes=LOCK_MINUTES)
                user.failed_logins = 0
            db.commit()
        raise HTTPException(401, GENERIC_LOGIN_ERROR)

    user.failed_logins = 0
    user.locked_until = None
    db.commit()
    start_session(db, user, request, response)
    return {"user": user.public()}


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
    start_session(db, user, request, response)
    return {"user": user.public(), "new_user": is_new}


@router.get("/config")
def public_config():
    """Public, non-secret settings the sign-in page needs."""
    return {
        "google_client_id": settings.google_client_id or None,
        "bank_linking": bool(settings.plaid_client_id and settings.plaid_secret),
    }


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    end_session(db, request, response)
    return {"ok": True}


@router.post("/logout-everywhere")
def logout_everywhere(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    end_all_sessions(db, user.id)
    end_session(db, request, response)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"user": user.public()}


@router.post("/verify-email")
def verify_email(body: TokenIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verify_token_hash == token_hash(body.token)).first()
    if not user:
        raise HTTPException(400, "This verification link is invalid or has expired.")
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
        bg.add_task(emails.send_password_reset, user.email, f"{settings.app_url}/?reset={token}")
    # Same answer whether or not the account exists (prevents email enumeration).
    return {"ok": True, "message": "If that email has an account, a reset link is on its way."}


@router.post("/reset-password")
def reset_password(body: ResetIn, db: Session = Depends(get_db)):
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
    return {"ok": True}
