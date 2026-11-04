"""Database tables. Every finance row belongs to exactly one user (user_id)."""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(d):
    return d.isoformat() if d else None


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # brute-force protection
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # one-time tokens (only SHA-256 hashes are stored)
    verify_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reset_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reset_expires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # preferences
    stock_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    stock_alert_threshold: Mapped[float] = mapped_column(Float, default=3.0)  # percent

    # SMS multi-factor authentication
    # Phone numbers are stored encrypted (phone_enc). The old plaintext column is kept
    # only so existing values can be read and re-saved encrypted.
    _phone_legacy: Mapped[str | None] = mapped_column("phone", String(20), nullable=True)
    phone_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    sms_code_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sms_code_expires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sms_code_attempts: Mapped[int] = mapped_column(Integer, default=0)
    mfa_ticket_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    _pending_phone_legacy: Mapped[str | None] = mapped_column("pending_phone", String(20), nullable=True)
    pending_phone_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    verify_expires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # personalisation
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    start_page: Mapped[str] = mapped_column(String(20), default="dashboard")
    budget_alert_pct: Mapped[int] = mapped_column(Integer, default=85)
    savings_target_pct: Mapped[int] = mapped_column(Integer, default=20)

    @property
    def phone(self) -> str | None:
        from .security import decrypt_text
        return decrypt_text(self.phone_enc) if self.phone_enc else self._phone_legacy

    @phone.setter
    def phone(self, value: str | None) -> None:
        from .security import encrypt_text
        self.phone_enc = encrypt_text(value) if value else None
        self._phone_legacy = None

    @property
    def pending_phone(self) -> str | None:
        from .security import decrypt_text
        return decrypt_text(self.pending_phone_enc) if self.pending_phone_enc else self._pending_phone_legacy

    @pending_phone.setter
    def pending_phone(self, value: str | None) -> None:
        from .security import encrypt_text
        self.pending_phone_enc = encrypt_text(value) if value else None
        self._pending_phone_legacy = None

    def public(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "email_verified": self.email_verified,
            "has_password": self.password_hash is not None,
            "phone_masked": ("•••• " + self.phone[-4:]) if self.phone else None,
            "phone_verified": self.phone_verified,
            "mfa_enabled": self.mfa_enabled,
            "currency": self.currency or "USD",
            "start_page": self.start_page or "dashboard",
            "budget_alert_pct": self.budget_alert_pct or 85,
            "savings_target_pct": self.savings_target_pct or 20,
            "google_linked": self.google_sub is not None,
            "stock_alerts": self.stock_alerts,
            "stock_alert_threshold": self.stock_alert_threshold,
            "created_at": iso(self.created_at),
        }


class AuthSession(Base):
    """Server-side login session. The browser only holds a random token in an
    httpOnly cookie; we store its SHA-256 hash so a DB leak can't hijack logins."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    user_agent: Mapped[str] = mapped_column(String(255), default="")

    user: Mapped[User] = relationship()


class RateLimit(Base):
    """Fixed-window counters that work across serverless instances."""

    __tablename__ = "rate_limits"

    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime)
    count: Mapped[int] = mapped_column(Integer, default=0)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    amount: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    type: Mapped[str] = mapped_column(String(20))  # income | expense
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual | bank
    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    bank_account_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True, index=True)

    account: Mapped["BankAccount | None"] = relationship(lazy="joined")

    __table_args__ = (UniqueConstraint("user_id", "external_id", name="uq_txn_external"),)

    def to_dict(self):
        acct = self.account
        return {
            "account": {"id": acct.id, "name": acct.name, "mask": acct.mask, "kind": acct.kind} if acct else None,
            "id": self.id,
            "date": iso(self.date),
            "amount": self.amount,
            "category": self.category,
            "description": self.description,
            "type": self.type,
            "source": self.source,
        }


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(100))
    monthly_limit: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "category", name="uq_budget_category"),)


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    target_amount: Mapped[float] = mapped_column(Float)
    current_amount: Mapped[float] = mapped_column(Float, default=0.0)
    deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)

    def to_dict(self):
        progress = (self.current_amount / self.target_amount * 100) if self.target_amount > 0 else 0
        return {
            "id": self.id,
            "name": self.name,
            "target_amount": self.target_amount,
            "current_amount": self.current_amount,
            "remaining": self.target_amount - self.current_amount,
            "progress": progress,
            "deadline": iso(self.deadline),
            "description": self.description,
            "created_at": iso(self.created_at),
            "completed": self.completed,
        }


class SavingsTransaction(Base):
    __tablename__ = "savings_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("savings_goals.id", ondelete="CASCADE"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    date: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "goal_id": self.goal_id,
            "amount": self.amount,
            "date": iso(self.date),
            "description": self.description,
        }


class StockHolding(Base):
    __tablename__ = "stock_holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(12))
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    shares: Mapped[float] = mapped_column(Float)
    purchase_price: Mapped[float] = mapped_column(Float)
    purchase_date: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "symbol": self.symbol,
            "name": self.name,
            "shares": self.shares,
            "purchase_price": self.purchase_price,
            "total_cost": self.shares * self.purchase_price,
            "purchase_date": iso(self.purchase_date),
            "notes": self.notes,
        }


class BankItem(Base):
    """A bank connection made through Plaid. The Plaid access token is
    encrypted with Fernet (AES-128-CBC + HMAC-SHA256) and never leaves the server."""

    __tablename__ = "bank_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plaid_item_id: Mapped[str] = mapped_column(String(100), unique=True)
    access_token_enc: Mapped[bytes] = mapped_column(LargeBinary)
    institution_name: Mapped[str] = mapped_column(String(200), default="Bank")
    sync_cursor: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_synced: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("bank_items.id", ondelete="CASCADE"), index=True)
    plaid_account_id: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    mask: Mapped[str | None] = mapped_column(String(8), nullable=True)  # last 4 digits only
    type: Mapped[str] = mapped_column(String(40))
    subtype: Mapped[str | None] = mapped_column(String(40), nullable=True)
    current_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    available_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="USD")

    @property
    def kind(self) -> str:
        """checking | savings | credit | loan | investment | other"""
        sub = (self.subtype or "").lower()
        if self.type == "depository":
            return "savings" if sub in {"savings", "money market", "cd", "hsa"} else "checking"
        if self.type in {"credit", "loan", "investment"}:
            return self.type
        return "other"

    def to_dict(self):
        return {
            "id": self.id,
            "kind": self.kind,
            "item_id": self.item_id,
            "name": self.name,
            "mask": self.mask,
            "type": self.type,
            "subtype": self.subtype,
            "current_balance": self.current_balance,
            "available_balance": self.available_balance,
            "currency": self.currency,
        }


class Subscription(Base):
    """A recurring charge the user tracks (confirmed from detection or added by hand).
    status: active | cancelled | ignored (ignored = "not a subscription")."""

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    cycle: Mapped[str] = mapped_column(String(10), default="monthly")  # weekly | monthly | yearly
    next_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="Subscriptions")
    status: Mapped[str] = mapped_column(String(12), default="active")
    source: Mapped[str] = mapped_column(String(10), default="manual")  # manual | detected
    merchant_key: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @property
    def monthly_cost(self) -> float:
        return {"weekly": self.amount * 52 / 12, "yearly": self.amount / 12}.get(self.cycle, self.amount)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "amount": self.amount, "cycle": self.cycle,
            "next_date": iso(self.next_date), "category": self.category, "status": self.status,
            "source": self.source, "merchant_key": self.merchant_key,
            "monthly_cost": round(self.monthly_cost, 2), "cancelled_at": iso(self.cancelled_at),
        }


class SecurityEvent(Base):
    """Account security activity shown to the user (no IP addresses stored)."""

    __tablename__ = "security_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    device: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    def to_dict(self):
        return {"id": self.id, "kind": self.kind, "device": self.device, "created_at": iso(self.created_at)}
