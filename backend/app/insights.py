"""Lightweight analytics: summaries, predictions, anomalies and advice.
Plain Python statistics replace the old pandas / scikit-learn models."""
from collections import defaultdict
from datetime import datetime, timedelta
from statistics import mean, pstdev

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import Budget, Transaction, utcnow


def month_start(d: datetime | None = None) -> datetime:
    d = d or utcnow()
    return datetime(d.year, d.month, 1)


def prev_month_start(d: datetime) -> datetime:
    return datetime(d.year - 1, 12, 1) if d.month == 1 else datetime(d.year, d.month - 1, 1)


def _sum(db: Session, user_id: int, kind: str, start: datetime, end: datetime | None = None, category: str | None = None) -> float:
    q = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
        Transaction.user_id == user_id, Transaction.type == kind, Transaction.date >= start
    )
    if end:
        q = q.filter(Transaction.date < end)
    if category:
        q = q.filter(Transaction.category == category)
    return float(q.scalar() or 0)


def monthly_summary(db: Session, user_id: int) -> dict:
    start = month_start()
    income = _sum(db, user_id, "income", start)
    expenses = _sum(db, user_id, "expense", start)
    last = _sum(db, user_id, "expense", prev_month_start(start), start)
    change = ((expenses - last) / last * 100) if last > 0 else 0
    return {
        "total_income": income,
        "total_expenses": expenses,
        "net_savings": income - expenses,
        "savings_rate": ((income - expenses) / income * 100) if income > 0 else 0,
        "expense_change": change,
    }


def category_breakdown(db: Session, user_id: int) -> list[dict]:
    rows = (
        db.query(Transaction.category, func.sum(Transaction.amount))
        .filter(Transaction.user_id == user_id, Transaction.type == "expense", Transaction.date >= month_start())
        .group_by(Transaction.category)
        .all()
    )
    return sorted(({"category": c, "amount": float(t)} for c, t in rows), key=lambda r: -r["amount"])


def spending_trends(db: Session, user_id: int) -> list[dict]:
    since = utcnow() - timedelta(days=183)
    rows = db.query(Transaction.date, Transaction.amount).filter(
        Transaction.user_id == user_id, Transaction.type == "expense", Transaction.date >= since
    )
    monthly: dict[str, float] = defaultdict(float)
    for d, amt in rows:
        monthly[d.strftime("%Y-%m")] += amt
    return [{"month": k, "amount": v} for k, v in sorted(monthly.items())]


def budgets_with_spend(db: Session, user_id: int) -> list[dict]:
    start = month_start()
    spent = dict(
        db.query(Transaction.category, func.sum(Transaction.amount))
        .filter(Transaction.user_id == user_id, Transaction.type == "expense", Transaction.date >= start)
        .group_by(Transaction.category)
        .all()
    )
    out = []
    for b in db.query(Budget).filter(Budget.user_id == user_id).order_by(Budget.category):
        s = float(spent.get(b.category, 0) or 0)
        out.append({
            "id": b.id,
            "category": b.category,
            "monthly_limit": b.monthly_limit,
            "current_spent": s,
            "remaining": b.monthly_limit - s,
        })
    return out


def _monthly_by_category(db: Session, user_id: int, months: int = 6) -> dict[str, dict[str, float]]:
    since = month_start() - timedelta(days=31 * months)
    data: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    rows = db.query(Transaction.category, Transaction.date, Transaction.amount).filter(
        Transaction.user_id == user_id,
        Transaction.type == "expense",
        Transaction.date >= since,
        Transaction.date < month_start(),
    )
    for cat, d, amt in rows:
        data[cat][d.strftime("%Y-%m")] += amt
    return data


def predict_next_month(db: Session, user_id: int) -> dict:
    """Weighted average of the last 3 complete months per category (recent months count more)."""
    data = _monthly_by_category(db, user_id, 3)
    if not data:
        return {"error": "Add at least one full month of expenses to see predictions.", "predictions": {}}
    predictions = {}
    for cat, months in data.items():
        values = [v for _, v in sorted(months.items())][-3:]
        weights = [1, 2, 3][-len(values):]
        predictions[cat] = round(sum(v * w for v, w in zip(values, weights)) / sum(weights), 2)
    return {"predictions": predictions}


def unusual_transactions(db: Session, user_id: int) -> list[dict]:
    """Flag expenses more than 2.5 standard deviations above that category's average."""
    since = utcnow() - timedelta(days=180)
    txns = db.query(Transaction).filter(
        Transaction.user_id == user_id, Transaction.type == "expense", Transaction.date >= since
    ).all()
    by_cat: dict[str, list[Transaction]] = defaultdict(list)
    for t in txns:
        by_cat[t.category].append(t)
    flagged = []
    for items in by_cat.values():
        if len(items) < 5:
            continue
        amounts = [t.amount for t in items]
        mu, sd = mean(amounts), pstdev(amounts)
        if sd == 0:
            continue
        flagged += [t.to_dict() for t in items if (t.amount - mu) / sd > 2.5]
    return sorted(flagged, key=lambda t: t["date"], reverse=True)


def is_unusual(db: Session, user_id: int, category: str, amount: float) -> bool:
    amounts = [a for (a,) in db.query(Transaction.amount).filter(
        Transaction.user_id == user_id, Transaction.type == "expense", Transaction.category == category
    ).limit(200)]
    if len(amounts) < 5:
        return False
    mu, sd = mean(amounts), pstdev(amounts)
    return sd > 0 and (amount - mu) / sd > 2.5


def advice(db: Session, user_id: int) -> str:
    s = monthly_summary(db, user_id)
    tips: list[str] = []
    if s["total_income"] == 0 and s["total_expenses"] == 0:
        return "Add a few transactions (or link your bank) and Zenty will start spotting patterns for you."
    if s["total_income"] > 0:
        rate = s["savings_rate"]
        if rate < 0:
            tips.append(f"You've spent ${-s['net_savings']:,.0f} more than you earned this month. Pause non-essential purchases until next payday.")
        elif rate < 10:
            tips.append(f"Your savings rate is {rate:.0f}%. Aim for at least 20%; try automating a transfer on payday.")
        elif rate < 20:
            tips.append(f"Nice, you're saving {rate:.0f}% of income. A small push gets you to the 20% benchmark.")
        else:
            tips.append(f"Great job, you're saving {rate:.0f}% of your income this month. Consider putting the extra toward goals or investments.")
    over = [b for b in budgets_with_spend(db, user_id) if b["remaining"] < 0]
    for b in over[:2]:
        tips.append(f"You're ${-b['remaining']:,.0f} over your {b['category']} budget.")
    breakdown = category_breakdown(db, user_id)
    if breakdown and s["total_expenses"] > 0:
        top = breakdown[0]
        share = top["amount"] / s["total_expenses"] * 100
        if share > 35:
            tips.append(f"{top['category']} is {share:.0f}% of your spending. Look there first if you want to cut back.")
    if s["expense_change"] > 15:
        tips.append(f"Spending is up {s['expense_change']:.0f}% vs last month.")
    elif s["expense_change"] < -10:
        tips.append(f"Spending is down {-s['expense_change']:.0f}% vs last month. Keep it up!")
    return " ".join(tips) or "Your finances look steady this month. Keep tracking!"
