"""Scheduled jobs. Vercel Cron calls these with `Authorization: Bearer $CRON_SECRET`."""
import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import emails, stocks
from ..db import get_db
from ..models import RateLimit, StockHolding, User, utcnow

router = APIRouter(prefix="/api/internal", tags=["internal"], include_in_schema=False)
log = logging.getLogger("zenty.cron")


def _check(authorization: str | None, secret: str) -> None:
    expected = f"Bearer {secret}"
    if not secret or not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(404, "Not found.")  # hide the endpoint from scanners


@router.get("/daily-stock-digest")
def daily_stock_digest(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    from ..config import get_settings
    _check(authorization, get_settings().cron_secret)

    holdings = (
        db.query(StockHolding, User)
        .join(User, User.id == StockHolding.user_id)
        .filter(User.stock_alerts.is_(True), User.email_verified.is_(True))
        .all()
    )
    quotes = stocks.get_quotes(sorted({h.symbol for h, _ in holdings}))

    per_user: dict[int, dict] = {}
    for h, u in holdings:
        q = quotes.get(h.symbol)
        if not q or abs(q["price_change_percent"]) < u.stock_alert_threshold:
            continue
        entry = per_user.setdefault(u.id, {"user": u, "movers": {}})
        m = entry["movers"].setdefault(h.symbol, {
            "symbol": h.symbol, "name": q["name"], "price": q["current_price"],
            "change_pct": q["price_change_percent"], "shares": 0.0, "value_change": 0.0,
        })
        m["shares"] += h.shares
        m["value_change"] += h.shares * q["price_change"]

    sent = 0
    today = utcnow().strftime("%Y-%m-%d")
    for uid, entry in per_user.items():
        key = f"digest:{uid}:{today}"
        if db.get(RateLimit, key):  # already emailed today (cron retries are safe)
            continue
        u = entry["user"]
        movers = sorted(entry["movers"].values(), key=lambda m: -abs(m["change_pct"]))
        if emails.send_stock_digest(u.email, u.name, movers, u.stock_alert_threshold):
            db.add(RateLimit(key=key, window_start=utcnow(), count=1))
            db.commit()
            sent += 1
    log.info("Stock digest: %s users emailed", sent)
    return {"ok": True, "emailed": sent}


@router.get("/cleanup")
def cleanup(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    """Remove expired sessions and old rate-limit rows."""
    from datetime import timedelta

    from ..config import get_settings
    from ..models import AuthSession
    _check(authorization, get_settings().cron_secret)
    now = utcnow()
    s = db.query(AuthSession).filter(AuthSession.expires_at < now).delete()
    r = db.query(RateLimit).filter(RateLimit.window_start < now - timedelta(days=2)).delete()
    from ..models import SecurityEvent
    e = db.query(SecurityEvent).filter(SecurityEvent.created_at < now - timedelta(days=180)).delete()
    idle = db.query(AuthSession).filter(AuthSession.last_seen_at < now - timedelta(minutes=get_settings().session_idle_minutes)).delete()
    db.commit()
    return {"ok": True, "sessions_removed": s + idle, "rate_limits_removed": r, "security_events_removed": e}
