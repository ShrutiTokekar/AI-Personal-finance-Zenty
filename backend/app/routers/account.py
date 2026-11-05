"""Profile, preferences, password change, data export and account deletion."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import json

from .. import emails, sms, totp
from ..config import get_settings
from ..db import get_db
from ..models import (
    Subscription,
    AuthSession,
    BankAccount,
    BankItem,
    Budget,
    SavingsGoal,
    SavingsTransaction,
    StockHolding,
    Transaction,
    User,
)
from ..security import (
    SESSION_COOKIE,
    current_user,
    decrypt_text,
    device_label,
    encrypt_text,
    record_event,
    token_hash,
    decrypt,
    end_all_sessions,
    end_session,
    hash_password,
    password_problems,
    rate_limit,
    verify_password,
)

router = APIRouter(prefix="/api/account", tags=["account"])


CURRENCIES = {"USD", "CAD", "EUR", "GBP", "AUD", "INR", "JPY", "SGD", "NZD", "CHF", "MXN"}
START_PAGES = {"dashboard", "transactions", "bank", "budget", "savings", "subscriptions", "stocks", "analytics"}


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    stock_alerts: bool | None = None
    stock_alert_threshold: float | None = Field(default=None, ge=0.5, le=50)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    start_page: str | None = Field(default=None, max_length=20)
    budget_alert_pct: int | None = Field(default=None, ge=50, le=100)
    savings_target_pct: int | None = Field(default=None, ge=5, le=60)


class MfaToggleIn(BaseModel):
    enabled: bool
    password: str | None = Field(default=None, max_length=128)


class PhoneIn(BaseModel):
    phone: str = Field(min_length=7, max_length=24)
    password: str | None = Field(default=None, max_length=128)


class CodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class PasswordOnlyIn(BaseModel):
    password: str | None = Field(default=None, max_length=128)


class PasswordIn(BaseModel):
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


class DeleteIn(BaseModel):
    confirm: str = Field(max_length=320)  # must equal the account email
    password: str | None = Field(default=None, max_length=128)


@router.patch("/profile")
def update_profile(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.name is not None:
        user.name = body.name.strip()
    if body.stock_alerts is not None:
        user.stock_alerts = body.stock_alerts
    if body.stock_alert_threshold is not None:
        user.stock_alert_threshold = body.stock_alert_threshold
    if body.currency is not None:
        code = body.currency.upper()
        if code not in CURRENCIES:
            raise HTTPException(400, "Unsupported currency.")
        user.currency = code
    if body.start_page is not None:
        if body.start_page not in START_PAGES:
            raise HTTPException(400, "Unknown start page.")
        user.start_page = body.start_page
    if body.budget_alert_pct is not None:
        user.budget_alert_pct = body.budget_alert_pct
    if body.savings_target_pct is not None:
        user.savings_target_pct = body.savings_target_pct
    db.commit()
    return {"user": user.public()}


def _reauth(user: User, password: str | None) -> None:
    """Sensitive security changes need the current password (if the account has one)."""
    if user.password_hash and not verify_password(password or "", user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")


@router.post("/mfa")
def toggle_mfa(body: MfaToggleIn, request: Request, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"mfa-toggle:{user.id}", limit=10, window_seconds=900)
    _reauth(user, body.password)
    if body.enabled:
        if not get_settings().sms_enabled:
            raise HTTPException(503, "Text-message codes aren't switched on for Zenty yet.")
        if not (user.phone and user.phone_verified):
            raise HTTPException(400, "Verify your phone number first.")
    user.mfa_enabled = body.enabled
    db.commit()
    record_event(db, user, "mfa_enabled" if body.enabled else "mfa_disabled", request)
    if not body.enabled:
        bg.add_task(emails.send_security_alert, user.email, user.name, "Two-step sign-in turned off",
                    "Two-step sign-in was just turned off for your Zenty account.", device_label(request))
    return {"user": user.public()}


# ---------- authenticator app (free two-step sign-in) ----------

def _fresh_backup_codes(user: User) -> list[str]:
    codes = totp.new_backup_codes()
    user.backup_codes = json.dumps([token_hash(c) for c in codes])
    return codes


@router.post("/totp/setup")
def totp_setup(body: PasswordOnlyIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"totp-setup:{user.id}", limit=10, window_seconds=900)
    _reauth(user, body.password)
    secret = totp.new_secret()
    user.totp_pending_enc = encrypt_text(secret)
    db.commit()
    return {"secret": secret, "otpauth_url": totp.provisioning_uri(secret, user.email)}


@router.post("/totp/enable")
def totp_enable(body: CodeIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"totp-enable:{user.id}", limit=10, window_seconds=900)
    if not user.totp_pending_enc:
        raise HTTPException(400, "Start setup again from Settings.")
    secret = decrypt_text(user.totp_pending_enc)
    step = totp.verify(secret, body.code)
    if step is None:
        raise HTTPException(400, "That code isn't right. Make sure your phone's clock is set automatically, then try the newest code.")
    user.totp_secret_enc = user.totp_pending_enc
    user.totp_pending_enc = None
    user.totp_enabled = True
    user.totp_last_step = step
    codes = _fresh_backup_codes(user)
    db.commit()
    record_event(db, user, "totp_enabled", request)
    return {"user": user.public(), "backup_codes": codes}


@router.post("/totp/disable")
def totp_disable(body: PasswordOnlyIn, request: Request, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"totp-disable:{user.id}", limit=10, window_seconds=900)
    _reauth(user, body.password)
    user.totp_enabled = False
    user.totp_secret_enc = None
    user.totp_pending_enc = None
    user.totp_last_step = None
    user.backup_codes = None
    db.commit()
    record_event(db, user, "totp_disabled", request)
    bg.add_task(emails.send_security_alert, user.email, user.name, "Two-step sign-in turned off",
                "Authenticator-app sign-in was just turned off for your Zenty account.", device_label(request))
    return {"user": user.public()}


@router.post("/backup-codes")
def regenerate_backup_codes(body: PasswordOnlyIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"backup-codes:{user.id}", limit=5, window_seconds=3600)
    _reauth(user, body.password)
    if not user.totp_enabled:
        raise HTTPException(400, "Turn on authenticator sign-in first.")
    codes = _fresh_backup_codes(user)
    db.commit()
    record_event(db, user, "backup_codes_regenerated", request)
    return {"user": user.public(), "backup_codes": codes}


@router.post("/phone")
def change_phone(body: PhoneIn, request: Request, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"phone-change:{user.id}", limit=5, window_seconds=3600)
    _reauth(user, body.password)
    phone = sms.normalize_phone(body.phone)
    if get_settings().sms_enabled:
        # Only switch numbers once the new phone proves it can receive codes.
        user.pending_phone = phone
        sent = sms.issue_code(user, "verification", to=phone)
        db.commit()
        if not sent:
            raise HTTPException(502, "We couldn't text that number. Check it and try again.")
        return {"verification_sent": True, "user": user.public()}
    user.phone = phone
    user.phone_verified = False
    user.mfa_enabled = False
    db.commit()
    record_event(db, user, "phone_changed", request)
    bg.add_task(emails.send_security_alert, user.email, user.name, "Phone number changed",
                f"The phone number on your Zenty account was changed to one ending in {phone[-4:]}.", device_label(request))
    return {"verification_sent": False, "user": user.public()}


@router.post("/phone/confirm")
def confirm_phone(body: CodeIn, request: Request, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"phone-confirm:{user.id}", limit=10, window_seconds=900)
    if not user.pending_phone:
        raise HTTPException(400, "There's no number waiting to be confirmed.")
    try:
        sms.check_code(user, body.code)
    finally:
        db.commit()
    user.phone = user.pending_phone
    user.pending_phone = None
    user.phone_verified = True
    db.commit()
    record_event(db, user, "phone_changed", request)
    bg.add_task(emails.send_security_alert, user.email, user.name, "Phone number changed",
                f"The phone number on your Zenty account was changed to one ending in {(user.phone or '')[-4:]}.", device_label(request))
    return {"user": user.public()}


@router.post("/password")
def change_password(body: PasswordIn, request: Request, response: Response, bg: BackgroundTasks,
                    user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"pw-change:{user.id}", limit=5, window_seconds=900)
    if user.password_hash and not verify_password(body.current_password or "", user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    problem = password_problems(body.new_password, user.email)
    if problem:
        raise HTTPException(400, problem)
    user.password_hash = hash_password(body.new_password)
    db.commit()
    record_event(db, user, "password_changed", request)
    bg.add_task(emails.send_security_alert, user.email, user.name, "Password changed",
                "The password for your Zenty account was just changed, and your other devices were signed out.", device_label(request))
    # Sign out every other device; keep this one signed in with a fresh session.
    end_all_sessions(db, user.id)
    from ..security import start_session
    start_session(db, user, request, response)
    return {"ok": True}


@router.get("/sessions")
def sessions(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    mine = token_hash(request.cookies.get(SESSION_COOKIE, ""))
    rows = db.query(AuthSession).filter(AuthSession.user_id == user.id).order_by(AuthSession.created_at.desc()).all()
    return {"sessions": [{"id": s.id, "created_at": s.created_at.isoformat(), "expires_at": s.expires_at.isoformat(),
                          "device": s.user_agent[:160], "current": s.token_hash == mine} for s in rows]}


@router.delete("/sessions/{sid}")
def revoke_session(sid: int, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(AuthSession, sid)
    if not s or s.user_id != user.id:
        raise HTTPException(404, "Not found.")
    db.delete(s)
    db.commit()
    record_event(db, user, "session_revoked", request)
    return {"ok": True}


@router.get("/security-events")
def security_events(user: User = Depends(current_user), db: Session = Depends(get_db)):
    from ..models import SecurityEvent
    rows = db.query(SecurityEvent).filter(SecurityEvent.user_id == user.id).order_by(SecurityEvent.created_at.desc()).limit(25).all()
    return {"events": [e.to_dict() for e in rows]}


@router.get("/export")
def export_data(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Everything Zenty stores about you (minus secrets) as JSON."""
    uid = user.id
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == uid).all()
    return {
        "profile": user.public(),
        "transactions": [t.to_dict() for t in db.query(Transaction).filter(Transaction.user_id == uid)],
        "budgets": [{"category": b.category, "monthly_limit": b.monthly_limit} for b in db.query(Budget).filter(Budget.user_id == uid)],
        "savings_goals": [g.to_dict() for g in goals],
        "stocks": [s.to_dict() for s in db.query(StockHolding).filter(StockHolding.user_id == uid)],
        "bank_accounts": [a.to_dict() for a in db.query(BankAccount).filter(BankAccount.user_id == uid)],
        "subscriptions": [x.to_dict() for x in db.query(Subscription).filter(Subscription.user_id == uid)],
    }


@router.delete("")
def delete_account(body: DeleteIn, request: Request, response: Response,
                   user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.confirm.strip().lower() != user.email:
        raise HTTPException(400, "Type your email address to confirm.")
    if user.password_hash and not verify_password(body.password or "", user.password_hash):
        raise HTTPException(400, "Password is incorrect.")

    # Revoke bank access at Plaid before deleting our records.
    from .bank import _plaid
    for item in db.query(BankItem).filter(BankItem.user_id == user.id).all():
        try:
            _plaid("/item/remove", {"access_token": decrypt(item.access_token_enc)})
        except HTTPException:
            pass

    uid = user.id
    goal_ids = [g.id for g in db.query(SavingsGoal.id).filter(SavingsGoal.user_id == uid)]
    if goal_ids:
        db.query(SavingsTransaction).filter(SavingsTransaction.goal_id.in_(goal_ids)).delete(synchronize_session=False)
    from ..models import SecurityEvent
    for model in (SecurityEvent, Transaction, Subscription, BankAccount, BankItem, SavingsGoal, Budget, StockHolding, AuthSession):
        db.query(model).filter(model.user_id == uid).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    end_session(db, request, response)
    return {"ok": True}
