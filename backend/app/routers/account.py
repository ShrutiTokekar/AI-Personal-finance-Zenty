"""Profile, preferences, password change, data export and account deletion."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import sms
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
def toggle_mfa(body: MfaToggleIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"mfa-toggle:{user.id}", limit=10, window_seconds=900)
    _reauth(user, body.password)
    if body.enabled:
        if not get_settings().sms_enabled:
            raise HTTPException(503, "Text-message codes aren't switched on for Zenty yet.")
        if not (user.phone and user.phone_verified):
            raise HTTPException(400, "Verify your phone number first.")
    user.mfa_enabled = body.enabled
    db.commit()
    return {"user": user.public()}


@router.post("/phone")
def change_phone(body: PhoneIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
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
    return {"verification_sent": False, "user": user.public()}


@router.post("/phone/confirm")
def confirm_phone(body: CodeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
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
    return {"user": user.public()}


@router.post("/password")
def change_password(body: PasswordIn, request: Request, response: Response,
                    user: User = Depends(current_user), db: Session = Depends(get_db)):
    rate_limit(db, f"pw-change:{user.id}", limit=5, window_seconds=900)
    if user.password_hash and not verify_password(body.current_password or "", user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    problem = password_problems(body.new_password, user.email)
    if problem:
        raise HTTPException(400, problem)
    user.password_hash = hash_password(body.new_password)
    db.commit()
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
def revoke_session(sid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(AuthSession, sid)
    if not s or s.user_id != user.id:
        raise HTTPException(404, "Not found.")
    db.delete(s)
    db.commit()
    return {"ok": True}


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
    for model in (Transaction, Subscription, BankAccount, BankItem, SavingsGoal, Budget, StockHolding, AuthSession):
        db.query(model).filter(model.user_id == uid).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    end_session(db, request, response)
    return {"ok": True}
