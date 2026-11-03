"""Transactions, analytics, budgets, savings goals, stocks and the assistant.
Every query is scoped to the signed-in user, so no one can read another user's data."""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import assistant, insights, stocks
from ..db import get_db
from ..models import Budget, SavingsGoal, SavingsTransaction, StockHolding, Transaction, User, utcnow
from ..security import current_user

router = APIRouter(prefix="/api", tags=["finance"])

Money = Field(gt=0, lt=1_000_000_000)


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        d = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return d.replace(tzinfo=None)
    except ValueError as exc:
        raise HTTPException(400, "Invalid date.") from exc


def _owned(db: Session, model, obj_id: int, user: User):
    obj = db.get(model, obj_id)
    if not obj or obj.user_id != user.id:
        raise HTTPException(404, "Not found.")
    return obj


# ---------------- transactions ----------------

class TransactionIn(BaseModel):
    amount: float = Money
    category: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    date: str | None = None
    type: Literal["income", "expense"] = "expense"


@router.post("/transactions")
def create_transaction(body: TransactionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    unusual = body.type == "expense" and insights.is_unusual(db, user.id, body.category, body.amount)
    t = Transaction(
        user_id=user.id, amount=body.amount, category=body.category.strip(), description=body.description,
        type=body.type, date=_parse_date(body.date) or utcnow(),
    )
    db.add(t)
    db.commit()
    return {"success": True, "transaction": t.to_dict(), "anomaly_detected": unusual}


@router.get("/transactions")
def list_transactions(limit: int = 100, category: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Transaction).filter(Transaction.user_id == user.id)
    if category:
        q = q.filter(Transaction.category == category)
    rows = q.order_by(Transaction.date.desc()).limit(max(1, min(limit, 500))).all()
    return {"transactions": [t.to_dict() for t in rows]}


@router.delete("/transactions/{tid}")
def delete_transaction(tid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, Transaction, tid, user))
    db.commit()
    return {"success": True}


# ---------------- analytics & insights ----------------

@router.get("/analytics/summary")
def summary(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return insights.monthly_summary(db, user.id)


@router.get("/analytics/trends")
def trends(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"trends": insights.spending_trends(db, user.id)}


@router.get("/analytics/category-breakdown")
def breakdown(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"breakdown": insights.category_breakdown(db, user.id)}


@router.get("/predict/next-month")
def predict(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return insights.predict_next_month(db, user.id)


@router.get("/advice")
def get_advice(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"advice": insights.advice(db, user.id)}


@router.get("/anomalies")
def anomalies(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"anomalies": insights.unusual_transactions(db, user.id)}


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


@router.post("/chat")
def chat(body: ChatIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return assistant.respond(db, user.id, body.message)


# ---------------- budgets ----------------

class BudgetIn(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    monthly_limit: float = Money


class BudgetUpdate(BaseModel):
    monthly_limit: float = Money


@router.get("/budgets")
def get_budgets(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"budgets": insights.budgets_with_spend(db, user.id)}


@router.get("/budgets/summary")
def budget_summary(user: User = Depends(current_user), db: Session = Depends(get_db)):
    b = insights.budgets_with_spend(db, user.id)
    return {
        "total_budget": sum(x["monthly_limit"] for x in b),
        "total_spent": sum(x["current_spent"] for x in b),
        "total_remaining": sum(x["remaining"] for x in b),
        "budgets": b,
    }


@router.post("/budgets")
def create_budget(body: BudgetIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    cat = body.category.strip()
    b = db.query(Budget).filter(Budget.user_id == user.id, Budget.category == cat).first()
    if b:
        b.monthly_limit = body.monthly_limit
    else:
        b = Budget(user_id=user.id, category=cat, monthly_limit=body.monthly_limit)
        db.add(b)
    db.commit()
    return {"success": True, "budget": {"id": b.id, "category": b.category, "monthly_limit": b.monthly_limit}}


@router.put("/budgets/{bid}")
def update_budget(bid: int, body: BudgetUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    b = _owned(db, Budget, bid, user)
    b.monthly_limit = body.monthly_limit
    db.commit()
    return {"success": True, "budget": {"id": b.id, "category": b.category, "monthly_limit": b.monthly_limit}}


@router.delete("/budgets/{bid}")
def delete_budget(bid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, Budget, bid, user))
    db.commit()
    return {"success": True}


# ---------------- savings goals ----------------

class GoalIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    target_amount: float = Money
    deadline: str | None = None
    description: str | None = Field(default=None, max_length=500)


class ContributionIn(BaseModel):
    amount: float = Money
    description: str | None = Field(default=None, max_length=500)


@router.get("/savings/goals")
def get_goals(include_completed: bool = False, user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(SavingsGoal).filter(SavingsGoal.user_id == user.id)
    if not include_completed:
        q = q.filter(SavingsGoal.completed.is_(False))
    return {"goals": [g.to_dict() for g in q.order_by(SavingsGoal.created_at.desc())]}


@router.post("/savings/goals")
def create_goal(body: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = SavingsGoal(user_id=user.id, name=body.name.strip(), target_amount=body.target_amount,
                    deadline=_parse_date(body.deadline), description=body.description)
    db.add(g)
    db.commit()
    return {"success": True, "goal": g.to_dict()}


@router.post("/savings/goals/{gid}/contribute")
def contribute(gid: int, body: ContributionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = _owned(db, SavingsGoal, gid, user)
    g.current_amount += body.amount
    g.completed = g.current_amount >= g.target_amount
    db.add(SavingsTransaction(goal_id=g.id, amount=body.amount, description=body.description))
    db.commit()
    return {"success": True, "goal": g.to_dict()}


@router.get("/savings/goals/{gid}/transactions")
def goal_transactions(gid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = _owned(db, SavingsGoal, gid, user)
    rows = db.query(SavingsTransaction).filter(SavingsTransaction.goal_id == g.id).order_by(SavingsTransaction.date.desc())
    return {"transactions": [t.to_dict() for t in rows]}


@router.delete("/savings/goals/{gid}")
def delete_goal(gid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, SavingsGoal, gid, user))
    db.commit()
    return {"success": True}


# ---------------- stocks ----------------

class StockIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=12)
    shares: float = Field(gt=0, lt=1_000_000_000)
    purchase_price: float = Field(gt=0, lt=10_000_000)
    name: str | None = Field(default=None, max_length=200)
    purchase_date: str | None = None
    notes: str | None = Field(default=None, max_length=500)


@router.get("/stocks")
def get_stocks(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(StockHolding).filter(StockHolding.user_id == user.id).order_by(StockHolding.purchase_date.desc())
    return {"stocks": [s.to_dict() for s in rows]}


@router.post("/stocks")
def add_stock(body: StockIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    sym = stocks.clean_symbol(body.symbol)
    if not sym:
        raise HTTPException(400, "Invalid stock symbol.")
    s = StockHolding(user_id=user.id, symbol=sym, name=body.name, shares=body.shares, purchase_price=body.purchase_price,
                     purchase_date=_parse_date(body.purchase_date) or utcnow(), notes=body.notes)
    db.add(s)
    db.commit()
    return {"success": True, "stock": s.to_dict()}


@router.delete("/stocks/{sid}")
def delete_stock(sid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, StockHolding, sid, user))
    db.commit()
    return {"success": True}


@router.get("/stocks/portfolio")
def portfolio(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(StockHolding).filter(StockHolding.user_id == user.id).all()
    return {"total_holdings": len(rows), "total_invested": sum(s.shares * s.purchase_price for s in rows),
            "stocks": [s.to_dict() for s in rows]}


@router.get("/stocks/validate/{symbol}")
def validate_symbol(symbol: str, user: User = Depends(current_user)):
    q = stocks.get_quote(symbol)
    sym = stocks.clean_symbol(symbol) or symbol[:12]
    return {"symbol": sym, "valid": q is not None, "message": "Valid symbol" if q else "Invalid or unknown symbol"}


@router.get("/stocks/price/{symbol}")
def stock_price(symbol: str, user: User = Depends(current_user)):
    q = stocks.get_quote(symbol)
    if not q:
        raise HTTPException(404, "Symbol not found or no price data available.")
    return q


@router.post("/stocks/prices")
def stock_prices(symbols: list[str], user: User = Depends(current_user)):
    return {"prices": stocks.get_quotes(symbols)}


@router.get("/stocks/history/{symbol}")
def stock_history(symbol: str, period: str = "1mo", user: User = Depends(current_user)):
    h = stocks.get_history(symbol, period)
    if h is None:
        raise HTTPException(404, "No history available.")
    return {"symbol": stocks.clean_symbol(symbol), "period": period, "history": h}


@router.get("/stocks/search")
def stock_search(query: str, user: User = Depends(current_user)):
    return {"results": stocks.search(query)}
