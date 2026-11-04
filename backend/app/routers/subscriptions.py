"""Subscription management: confirm detected recurring charges, add your own,
edit, mark cancelled, or dismiss a detection as "not a subscription"."""
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import insights
from ..db import get_db
from ..models import Subscription, User, utcnow
from ..security import current_user

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

Cycle = Literal["weekly", "monthly", "yearly"]


class SubIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    amount: float = Field(ge=0, lt=1_000_000)
    cycle: Cycle = "monthly"
    next_date: str | None = None
    category: str | None = Field(default=None, max_length=100)
    merchant_key: str | None = Field(default=None, max_length=60)
    source: Literal["manual", "detected"] = "manual"


class SubPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    amount: float | None = Field(default=None, ge=0, lt=1_000_000)
    cycle: Cycle | None = None
    next_date: str | None = None
    status: Literal["active", "cancelled"] | None = None


class IgnoreIn(BaseModel):
    merchant_key: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=120)


def _parse(d: str | None) -> datetime | None:
    if not d:
        return None
    try:
        return datetime.fromisoformat(d.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as exc:
        raise HTTPException(400, "Invalid date.") from exc


def _roll_forward(s: Subscription) -> None:
    """Keep next_date in the future for active subscriptions."""
    if s.status != "active" or not s.next_date:
        return
    step = {"weekly": timedelta(days=7), "yearly": timedelta(days=365)}.get(s.cycle, timedelta(days=30))
    while s.next_date < utcnow() - timedelta(days=1):
        s.next_date += step


def _owned(db: Session, sid: int, user: User) -> Subscription:
    s = db.get(Subscription, sid)
    if not s or s.user_id != user.id:
        raise HTTPException(404, "Not found.")
    return s


def summary(db: Session, user_id: int) -> dict:
    subs = db.query(Subscription).filter(Subscription.user_id == user_id).all()
    for s in subs:
        _roll_forward(s)
    db.commit()
    known = {s.merchant_key for s in subs if s.merchant_key}
    detected = [d for d in insights.recurring_charges(db, user_id)["items"] if d.get("merchant_key") not in known]
    active = [s for s in subs if s.status == "active"]
    soon = utcnow() + timedelta(days=14)
    return {
        "items": [s.to_dict() for s in sorted(subs, key=lambda x: (x.status != "active", x.next_date or utcnow())) if s.status != "ignored"],
        "suggestions": detected,
        "totals": {"monthly": round(sum(s.monthly_cost for s in active), 2),
                   "yearly": round(sum(s.monthly_cost for s in active) * 12, 2),
                   "active": len(active)},
        "upcoming": [s.to_dict() for s in active if s.next_date and s.next_date <= soon],
    }


@router.get("")
def list_subscriptions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return summary(db, user.id)


@router.post("")
def add_subscription(body: SubIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.merchant_key:
        existing = db.query(Subscription).filter(Subscription.user_id == user.id, Subscription.merchant_key == body.merchant_key).first()
        if existing:
            existing.status = "active"
            db.commit()
            return {"subscription": existing.to_dict()}
    s = Subscription(user_id=user.id, name=body.name.strip(), amount=body.amount, cycle=body.cycle,
                     next_date=_parse(body.next_date), category=(body.category or "Subscriptions").strip(),
                     merchant_key=body.merchant_key, source=body.source)
    db.add(s)
    db.commit()
    return {"subscription": s.to_dict()}


@router.patch("/{sid}")
def update_subscription(sid: int, body: SubPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = _owned(db, sid, user)
    if body.name is not None:
        s.name = body.name.strip()
    if body.amount is not None:
        s.amount = body.amount
    if body.cycle is not None:
        s.cycle = body.cycle
    if body.next_date is not None:
        s.next_date = _parse(body.next_date)
    if body.status is not None:
        s.status = body.status
        s.cancelled_at = utcnow() if body.status == "cancelled" else None
    db.commit()
    return {"subscription": s.to_dict()}


@router.delete("/{sid}")
def delete_subscription(sid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, sid, user))
    db.commit()
    return {"ok": True}


@router.post("/ignore")
def ignore_detection(body: IgnoreIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Remember that a detected recurring charge is not a subscription."""
    s = db.query(Subscription).filter(Subscription.user_id == user.id, Subscription.merchant_key == body.merchant_key).first()
    if not s:
        s = Subscription(user_id=user.id, name=body.name[:120], merchant_key=body.merchant_key, source="detected")
        db.add(s)
    s.status = "ignored"
    db.commit()
    return {"ok": True}
