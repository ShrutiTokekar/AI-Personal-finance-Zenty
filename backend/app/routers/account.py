"""Profile, preferences, password change, data export and account deletion."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
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
    current_user,
    decrypt,
    end_all_sessions,
    end_session,
    hash_password,
    password_problems,
    rate_limit,
    verify_password,
)

router = APIRouter(prefix="/api/account", tags=["account"])


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    stock_alerts: bool | None = None
    stock_alert_threshold: float | None = Field(default=None, ge=0.5, le=50)


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
def sessions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(AuthSession).filter(AuthSession.user_id == user.id).order_by(AuthSession.created_at.desc()).all()
    return {"sessions": [{"created_at": s.created_at.isoformat(), "expires_at": s.expires_at.isoformat(),
                          "device": s.user_agent[:80]} for s in rows]}


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
    for model in (BankAccount, BankItem, SavingsGoal, Budget, StockHolding, Transaction, AuthSession):
        db.query(model).filter(model.user_id == uid).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    end_session(db, request, response)
    return {"ok": True}
