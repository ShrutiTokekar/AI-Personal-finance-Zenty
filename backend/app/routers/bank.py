"""Bank linking through Plaid.

Security model:
- Users type their bank login only into Plaid Link (Plaid's own secure window).
  Zenty never sees or stores bank usernames or passwords.
- Plaid returns an access token to the SERVER only. It is encrypted with Fernet
  before it is saved and is never sent to the browser or any API response.
- Only account names, the last 4 digits and balances are stored.
- Bank linking requires a verified email, and every row is scoped to its owner.
"""
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import BankAccount, BankItem, Transaction, User, utcnow
from ..security import decrypt, encrypt, rate_limit, verified_user

router = APIRouter(prefix="/api/bank", tags=["bank"])
settings = get_settings()

PLAID_HOSTS = {
    "sandbox": "https://sandbox.plaid.com",
    "production": "https://production.plaid.com",
}


def _plaid(path: str, payload: dict) -> dict:
    if not (settings.plaid_client_id and settings.plaid_secret):
        raise HTTPException(503, "Bank linking is not configured on this server yet.")
    host = PLAID_HOSTS.get(settings.plaid_env, PLAID_HOSTS["sandbox"])
    try:
        r = httpx.post(
            f"{host}{path}",
            json={"client_id": settings.plaid_client_id, "secret": settings.plaid_secret, **payload},
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Could not reach the bank connection service.") from exc
    data = r.json()
    if r.status_code != 200:
        # Never echo Plaid internals (they can include request ids / tokens).
        code = data.get("error_code", "UNKNOWN")
        if code == "ITEM_LOGIN_REQUIRED":
            raise HTTPException(409, "Your bank needs you to sign in again. Please reconnect this bank.")
        raise HTTPException(502, f"Bank service error ({code}).")
    return data


class PublicTokenIn(BaseModel):
    public_token: str = Field(min_length=10, max_length=200)


def _category(txn: dict) -> str:
    pfc = (txn.get("personal_finance_category") or {}).get("primary")
    if pfc:
        return pfc.replace("_", " ").title().replace("And", "&")
    cats = txn.get("category") or []
    return cats[0] if cats else "Other"


def _save_accounts(db: Session, user: User, item: BankItem, accounts: list[dict]) -> None:
    for a in accounts:
        row = db.query(BankAccount).filter(BankAccount.plaid_account_id == a["account_id"]).first()
        if not row:
            row = BankAccount(user_id=user.id, item_id=item.id, plaid_account_id=a["account_id"],
                              name=a.get("name") or "Account", type=a.get("type") or "other")
            db.add(row)
        bal = a.get("balances") or {}
        row.name = (a.get("official_name") or a.get("name") or "Account")[:200]
        row.mask = (a.get("mask") or "")[-4:] or None
        row.type = a.get("type") or "other"
        row.subtype = a.get("subtype")
        row.current_balance = bal.get("current")
        row.available_balance = bal.get("available")
        row.currency = bal.get("iso_currency_code") or "USD"


def _sync_transactions(db: Session, user: User, item: BankItem) -> int:
    token = decrypt(item.access_token_enc)
    cursor = item.sync_cursor
    added_count = 0
    for _ in range(10):  # page through updates (max ~5,000 txns per sync)
        payload = {"access_token": token, "count": 500}
        if cursor:
            payload["cursor"] = cursor
        data = _plaid("/transactions/sync", payload)
        for t in data.get("added", []) + data.get("modified", []):
            if t.get("pending"):
                continue
            row = db.query(Transaction).filter(Transaction.user_id == user.id,
                                               Transaction.external_id == t["transaction_id"]).first()
            amount = float(t["amount"])
            if not row:
                row = Transaction(user_id=user.id, external_id=t["transaction_id"], source="bank",
                                  amount=0, category="Other", type="expense")
                db.add(row)
                added_count += 1
            row.amount = abs(amount)
            row.type = "expense" if amount > 0 else "income"  # Plaid: positive = money out
            row.category = _category(t)[:100]
            row.description = (t.get("merchant_name") or t.get("name") or "")[:500]
            row.date = datetime.fromisoformat(t["date"])
        removed = [r["transaction_id"] for r in data.get("removed", [])]
        if removed:
            db.query(Transaction).filter(Transaction.user_id == user.id,
                                         Transaction.external_id.in_(removed)).delete(synchronize_session=False)
        cursor = data.get("next_cursor")
        if not data.get("has_more"):
            break
    item.sync_cursor = cursor
    item.last_synced = utcnow()
    db.commit()
    return added_count


@router.post("/link-token")
def create_link_token(request: Request, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    rate_limit(db, f"plaid-link:{user.id}", limit=10, window_seconds=3600)
    data = _plaid("/link/token/create", {
        "client_name": "Zenty",
        "user": {"client_user_id": f"zenty-{user.id}"},
        "products": ["transactions"],
        "country_codes": ["US", "CA"],
        "language": "en",
    })
    # link_token is short-lived and only lets the browser open Plaid Link.
    return {"link_token": data["link_token"]}


@router.post("/exchange")
def exchange_public_token(body: PublicTokenIn, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    rate_limit(db, f"plaid-exchange:{user.id}", limit=10, window_seconds=3600)
    data = _plaid("/item/public_token/exchange", {"public_token": body.public_token})
    access_token, item_id = data["access_token"], data["item_id"]

    accounts = _plaid("/accounts/get", {"access_token": access_token})
    inst_name = "Bank"
    inst_id = (accounts.get("item") or {}).get("institution_id")
    if inst_id:
        try:
            inst = _plaid("/institutions/get_by_id", {"institution_id": inst_id, "country_codes": ["US", "CA"]})
            inst_name = inst["institution"]["name"]
        except HTTPException:
            pass

    item = db.query(BankItem).filter(BankItem.plaid_item_id == item_id).first()
    if item and item.user_id != user.id:
        raise HTTPException(409, "This bank connection belongs to another account.")
    if not item:
        item = BankItem(user_id=user.id, plaid_item_id=item_id, access_token_enc=encrypt(access_token),
                        institution_name=inst_name[:200])
        db.add(item)
    else:
        item.access_token_enc = encrypt(access_token)
    db.flush()
    _save_accounts(db, user, item, accounts.get("accounts", []))
    db.commit()

    imported = 0
    try:
        imported = _sync_transactions(db, user, item)
    except HTTPException:
        pass  # transactions may not be ready yet right after linking; a later sync picks them up
    return {"success": True, "institution": item.institution_name, "imported": imported}


@router.get("/accounts")
def list_accounts(user: User = Depends(verified_user), db: Session = Depends(get_db)):
    items = db.query(BankItem).filter(BankItem.user_id == user.id).order_by(BankItem.created_at).all()
    out = []
    for it in items:
        accts = db.query(BankAccount).filter(BankAccount.item_id == it.id).all()
        out.append({
            "id": it.id,
            "institution": it.institution_name,
            "last_synced": it.last_synced.isoformat() if it.last_synced else None,
            "accounts": [a.to_dict() for a in accts],
        })
    total = sum((a["current_balance"] or 0) for i in out for a in i["accounts"]
                if a["type"] in ("depository", "investment"))
    debt = sum((a["current_balance"] or 0) for i in out for a in i["accounts"] if a["type"] in ("credit", "loan"))
    return {"items": out, "total_assets": total, "total_debt": debt}


@router.post("/sync")
def sync_all(user: User = Depends(verified_user), db: Session = Depends(get_db)):
    rate_limit(db, f"plaid-sync:{user.id}", limit=12, window_seconds=3600)
    imported = 0
    errors = []
    for item in db.query(BankItem).filter(BankItem.user_id == user.id).all():
        try:
            token = decrypt(item.access_token_enc)
            bal = _plaid("/accounts/balance/get", {"access_token": token})
            _save_accounts(db, user, item, bal.get("accounts", []))
            db.commit()
            imported += _sync_transactions(db, user, item)
        except HTTPException as exc:
            errors.append({"institution": item.institution_name, "error": exc.detail})
    return {"success": not errors, "imported": imported, "errors": errors}


@router.delete("/items/{item_id}")
def unlink(item_id: int, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    item = db.get(BankItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(404, "Not found.")
    try:
        _plaid("/item/remove", {"access_token": decrypt(item.access_token_enc)})
    except HTTPException:
        pass  # still remove our copy even if Plaid already revoked it
    db.query(BankAccount).filter(BankAccount.item_id == item.id).delete()
    db.delete(item)
    db.commit()
    return {"success": True}
