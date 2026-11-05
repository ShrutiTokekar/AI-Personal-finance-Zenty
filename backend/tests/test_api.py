import os
import tempfile

_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.name}"
os.environ["CRON_SECRET"] = "test-cron-secret"
os.environ["ZENTY_ENCRYPTION_KEY"] = "uS3dWf1tQ3c9r3l0bTqzYkP4m6hN8sV2xA5eJ7gK0iE="

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PW = "Str0ng-Passw0rd!"


_ip = iter(range(1, 10_000))


def client():
    c = TestClient(app)
    c.headers.update({"X-Requested-With": "zenty", "X-Forwarded-For": f"10.0.0.{next(_ip)}"})
    return c


def signup(c, email, name="Test User"):
    r = c.post("/api/auth/signup", json={"name": name, "email": email, "password": PW, "confirm_password": PW, "phone": "+14155550123"})
    assert r.status_code == 200, r.text
    c.headers["X-CSRF-Token"] = c.cookies.get("zenty_csrf")
    return r.json()["user"]


@pytest.fixture(scope="module", autouse=True)
def _startup():
    with TestClient(app):
        yield


def test_signup_sets_httponly_cookie_and_hides_hash():
    c = client()
    r = c.post("/api/auth/signup", json={"name": "A", "email": "a@example.com", "password": PW, "confirm_password": PW, "phone": "+14155550123"})
    assert r.status_code == 200
    set_cookie = r.headers.get_list("set-cookie")
    session = [h for h in set_cookie if h.startswith("zenty_session=")][0]
    assert "HttpOnly" in session and "SameSite=strict" in session
    assert "password" not in r.text.lower().replace("has_password", "")


def test_weak_password_rejected():
    r = client().post("/api/auth/signup", json={"name": "W", "email": "w@example.com", "password": "password", "confirm_password": "password", "phone": "+14155550123"})
    assert r.status_code == 400


def test_duplicate_email_rejected():
    c = client()
    signup(c, "dup@example.com")
    r = client().post("/api/auth/signup", json={"name": "B", "email": "DUP@example.com", "password": PW, "confirm_password": PW, "phone": "+14155550123"})
    assert r.status_code == 409


def test_login_and_wrong_password_and_lockout():
    signup(client(), "lock@example.com")
    c = client()
    assert c.post("/api/auth/login", json={"email": "lock@example.com", "password": PW}).status_code == 200
    bad = client()
    for _ in range(5):
        assert bad.post("/api/auth/login", json={"email": "lock@example.com", "password": "nope"}).status_code == 401
    r = bad.post("/api/auth/login", json={"email": "lock@example.com", "password": PW})
    assert r.status_code == 429  # locked even with the right password


def test_unknown_email_same_error_as_wrong_password():
    r = client().post("/api/auth/login", json={"email": "ghost@example.com", "password": PW})
    assert r.status_code == 401 and r.json()["detail"] == "Incorrect email or password."


def test_requires_login():
    assert client().get("/api/transactions").status_code == 401


def test_users_cannot_see_or_delete_each_others_data():
    alice, bob = client(), client()
    signup(alice, "alice@example.com", "Alice")
    signup(bob, "bob@example.com", "Bob")
    r = alice.post("/api/transactions", json={"amount": 42.5, "category": "Food", "type": "expense"})
    tid = r.json()["transaction"]["id"]
    alice.post("/api/budgets", json={"category": "Food", "monthly_limit": 100})
    g = alice.post("/api/savings/goals", json={"name": "Trip", "target_amount": 500}).json()["goal"]["id"]

    assert bob.get("/api/transactions").json()["transactions"] == []
    assert bob.get("/api/budgets").json()["budgets"] == []
    assert bob.delete(f"/api/transactions/{tid}").status_code == 404
    assert bob.post(f"/api/savings/goals/{g}/contribute", json={"amount": 10}).status_code == 404
    assert bob.get(f"/api/savings/goals/{g}/transactions").status_code == 404
    assert len(alice.get("/api/transactions").json()["transactions"]) == 1
    b = alice.get("/api/budgets").json()["budgets"][0]
    assert b["current_spent"] == 42.5 and b["remaining"] == 57.5


def test_csrf_required_for_signed_in_writes():
    c = client()
    signup(c, "csrf@example.com")
    del c.headers["X-CSRF-Token"]
    r = c.post("/api/transactions", json={"amount": 1, "category": "X", "type": "expense"})
    assert r.status_code == 403


def test_cross_site_request_without_custom_header_blocked():
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"email": "a@example.com", "password": PW})
    assert r.status_code == 403


def test_logout_revokes_session():
    c = client()
    signup(c, "logout@example.com")
    token = c.cookies.get("zenty_session")
    assert c.post("/api/auth/logout").status_code == 200
    c2 = client()
    c2.cookies.set("zenty_session", token)
    assert c2.get("/api/auth/me").status_code == 401


def test_assistant_logs_expense_and_reports():
    c = client()
    signup(c, "chat@example.com")
    r = c.post("/api/chat", json={"message": "spent $25 on lunch"}).json()
    assert "25.00" in r["message"] and "Food" in r["message"]
    r = c.post("/api/chat", json={"message": "got paid 2000 salary"}).json()
    assert "2,000.00" in r["message"]
    r = c.post("/api/chat", json={"message": "how much did I spend?"}).json()
    assert "Spent: $25.00" in r["message"]
    r = c.post("/api/chat", json={"message": "set budget groceries 400"}).json()
    assert "Groceries" in r["message"]
    r = c.post("/api/chat", json={"message": "create goal vacation 2000"}).json()
    assert "Vacation" in r["message"]
    r = c.post("/api/chat", json={"message": "save 50 to vacation"}).json()
    assert "50.00" in r["message"]


def test_bank_requires_verified_email():
    c = client()
    signup(c, "bank@example.com")
    assert c.get("/api/bank/accounts").status_code == 403


def test_bank_token_encrypted_and_never_returned(monkeypatch):
    from app.models import BankItem, User
    from app.db import SessionLocal
    from app.routers import bank

    c = client()
    signup(c, "plaid@example.com")
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="plaid@example.com").one()
        u.email_verified = True
        db.commit()

    secret_token = "access-sandbox-SUPERSECRET"

    def fake_plaid(path, payload):
        return {
            "/item/public_token/exchange": {"access_token": secret_token, "item_id": "item-1"},
            "/accounts/get": {"item": {}, "accounts": [
                {"account_id": "acc-1", "name": "Checking", "mask": "1234", "type": "depository", "subtype": "checking", "balances": {"current": 900.0}},
                {"account_id": "acc-2", "name": "Sapphire", "mask": "9876", "type": "credit", "subtype": "credit card", "balances": {"current": 250.0}},
                {"account_id": "acc-3", "name": "High-yield", "mask": "5555", "type": "depository", "subtype": "savings", "balances": {"current": 5000.0}}]},
            "/transactions/sync": {"added": [
                {"transaction_id": "t1", "account_id": "acc-1", "amount": 12.0, "date": "2026-10-30", "name": "Coffee", "personal_finance_category": {"primary": "FOOD_AND_DRINK"}},
                {"transaction_id": "t2", "account_id": "acc-2", "amount": 80.0, "date": "2026-10-29", "name": "Amazon", "personal_finance_category": {"primary": "GENERAL_MERCHANDISE"}},
                {"transaction_id": "t3", "account_id": "acc-3", "amount": -25.0, "date": "2026-10-28", "name": "Interest", "personal_finance_category": {"primary": "INCOME"}}],
                                   "modified": [], "removed": [], "next_cursor": "c1", "has_more": False},
        }[path]

    monkeypatch.setattr(bank, "_plaid", fake_plaid)
    r = c.post("/api/bank/exchange", json={"public_token": "public-sandbox-xyz"})
    assert r.status_code == 200 and secret_token not in r.text
    accts = c.get("/api/bank/accounts")
    assert secret_token not in accts.text and accts.json()["items"][0]["accounts"][0]["mask"] == "1234"
    with SessionLocal() as db:
        item = db.query(BankItem).one()
        assert secret_token.encode() not in item.access_token_enc
    txns = {t["description"]: t for t in c.get("/api/transactions").json()["transactions"] if t["source"] == "bank"}
    assert txns["Coffee"]["account"]["kind"] == "checking" and txns["Coffee"]["account"]["mask"] == "1234"
    assert txns["Amazon"]["account"]["kind"] == "credit"
    assert txns["Interest"]["account"]["kind"] == "savings" and txns["Interest"]["type"] == "income"
    kinds = {a["kind"] for i in c.get("/api/bank/accounts").json()["items"] for a in i["accounts"]}
    assert kinds == {"checking", "credit", "savings"}


def test_cron_requires_secret():
    c = TestClient(app)
    assert c.get("/api/internal/daily-stock-digest").status_code == 404
    assert c.get("/api/internal/daily-stock-digest", headers={"Authorization": "Bearer wrong"}).status_code == 404


def test_stock_digest_sends_for_big_movers(monkeypatch):
    from app import emails, stocks
    from app.db import SessionLocal
    from app.models import User

    c = client()
    signup(c, "investor@example.com", "Ivy Investor")
    c.post("/api/stocks", json={"symbol": "AAPL", "shares": 10, "purchase_price": 150})
    with SessionLocal() as db:
        db.query(User).filter_by(email="investor@example.com").one().email_verified = True
        db.commit()

    monkeypatch.setattr(stocks, "get_quotes", lambda syms: {s: {"name": "Apple", "current_price": 200.0,
                                                               "price_change": 10.0, "price_change_percent": 5.26} for s in syms})
    sent = []
    monkeypatch.setattr(emails, "send_stock_digest", lambda to, name, movers, th: sent.append((to, movers)) or True)
    auth = {"Authorization": "Bearer test-cron-secret"}
    r = TestClient(app).get("/api/internal/daily-stock-digest", headers=auth)
    assert r.json()["emailed"] >= 1
    assert any(to == "investor@example.com" and m[0]["value_change"] == 100.0 for to, m in sent)
    # second run same day doesn't double-send
    sent.clear()
    TestClient(app).get("/api/internal/daily-stock-digest", headers=auth)
    assert not any(to == "investor@example.com" for to, _ in sent)


def test_password_reset_flow(monkeypatch):
    from app import emails
    from app.routers import auth as auth_router
    links = []
    monkeypatch.setattr(emails, "send_password_reset", lambda to, url: links.append(url) or True)
    monkeypatch.setattr(auth_router.emails, "send_password_reset", lambda to, url: links.append(url) or True)
    signup(client(), "reset@example.com")
    r = client().post("/api/auth/forgot-password", json={"email": "reset@example.com"})
    assert r.status_code == 200 and links
    token = links[0].split("reset=")[1]
    new_pw = "An0ther-Str0ng-Pass!"
    assert client().post("/api/auth/reset-password", json={"token": token, "password": new_pw}).status_code == 200
    assert client().post("/api/auth/reset-password", json={"token": token, "password": new_pw}).status_code == 400
    assert client().post("/api/auth/login", json={"email": "reset@example.com", "password": new_pw}).status_code == 200


def test_delete_account_removes_everything():
    c = client()
    signup(c, "bye@example.com")
    c.post("/api/transactions", json={"amount": 5, "category": "X", "type": "expense"})
    r = c.request("DELETE", "/api/account", json={"confirm": "bye@example.com", "password": PW})
    assert r.status_code == 200
    assert client().post("/api/auth/login", json={"email": "bye@example.com", "password": PW}).status_code == 401


def test_security_headers():
    r = client().get("/api/health")
    assert r.headers["X-Frame-Options"] == "DENY"
    assert r.headers["Cache-Control"] == "no-store"


def test_overview_scores_and_recurring():
    from datetime import datetime, timedelta
    from app.db import SessionLocal
    from app.models import Transaction, User
    c = client()
    signup(c, "overview@example.com")
    c.post("/api/transactions", json={"amount": 3000, "category": "Salary", "type": "income"})
    c.post("/api/transactions", json={"amount": 400, "category": "Groceries", "type": "expense"})
    c.post("/api/budgets", json={"category": "Groceries", "monthly_limit": 600})
    with SessionLocal() as db:
        uid = db.query(User).filter_by(email="overview@example.com").one().id
        now = datetime.utcnow()
        for m in (1, 2, 3):
            db.add(Transaction(user_id=uid, amount=15.99, category="Entertainment", type="expense",
                               description="NETFLIX.COM 1234", date=now - timedelta(days=30 * m)))
        db.commit()
    r = c.get("/api/overview")
    assert r.status_code == 200
    d = r.json()
    assert 0 <= d["zen"]["score"] <= 100 and len(d["zen"]["factors"]) == 4
    assert d["safe_to_spend"]["remaining"] == 200
    assert any("NETFLIX" in x["name"] for x in d["recurring"]["items"])
    assert len(d["daily"]) >= 28
    # isolation: another user sees nothing
    other = client()
    signup(other, "overview2@example.com")
    o = other.get("/api/overview").json()
    assert o["recent"] == [] and o["recurring"]["items"] == []


def test_signup_requires_matching_passwords_and_valid_phone():
    base = {"name": "M", "email": "match@example.com", "password": PW, "phone": "+14155550123"}
    r = client().post("/api/auth/signup", json={**base, "confirm_password": PW + "x"})
    assert r.status_code == 400 and "match" in r.json()["detail"]
    r = client().post("/api/auth/signup", json={**base, "confirm_password": PW, "phone": "1234567"})
    assert r.status_code == 400 and "mobile number" in r.json()["detail"]
    r = client().post("/api/auth/signup", json={**base, "confirm_password": PW, "phone": "(415) 555-0199"})
    assert r.status_code == 200 and r.json()["user"]["phone_masked"] == "•••• 0199"


def test_welcome_email_sent_with_verification_link(monkeypatch):
    from app.routers import auth as auth_router
    sent = []
    monkeypatch.setattr(auth_router.emails, "send_welcome", lambda to, name, url: sent.append((to, url)) or True)
    signup(client(), "welcome@example.com", "Wren")
    assert sent and sent[0][0] == "welcome@example.com" and "#verify=" in sent[0][1]
    token = sent[0][1].split("verify=")[1]
    assert client().post("/api/auth/verify-email", json={"token": token}).status_code == 200


def test_sms_mfa_signup_and_login(monkeypatch):
    from app import sms
    from app.config import Settings
    monkeypatch.setattr(Settings, "sms_enabled", property(lambda self: True))
    texts = []
    monkeypatch.setattr(sms, "_send", lambda to, body: texts.append((to, body)) or True)
    code = lambda: texts[-1][1].split("code is ")[1][:6]

    c = client()
    r = c.post("/api/auth/signup", json={"name": "Mo", "email": "mfa@example.com", "password": PW, "confirm_password": PW, "phone": "+14155550111"})
    assert r.status_code == 200 and r.json()["phone_verification_required"] is True
    c.headers["X-CSRF-Token"] = c.cookies.get("zenty_csrf")
    assert texts[-1][0] == "+14155550111"
    assert c.post("/api/auth/phone/verify", json={"code": "000000" if code() != "000000" else "111111"}).status_code == 400
    r = c.post("/api/auth/phone/verify", json={"code": code()})
    assert r.status_code == 200 and r.json()["user"]["phone_verified"] is True

    # Password alone no longer signs you in.
    d = client()
    r = d.post("/api/auth/login", json={"email": "mfa@example.com", "password": PW})
    assert r.status_code == 200 and r.json()["mfa_required"] is True
    assert "zenty_session" not in d.cookies
    ticket = r.json()["mfa_ticket"]
    assert d.post("/api/auth/mfa/verify", json={"ticket": ticket, "code": "123456" if code() != "123456" else "654321"}).status_code == 400
    r = d.post("/api/auth/mfa/verify", json={"ticket": ticket, "code": code()})
    assert r.status_code == 200 and d.cookies.get("zenty_session")
    # ticket is single-use
    assert client().post("/api/auth/mfa/verify", json={"ticket": ticket, "code": code()}).status_code == 400


def test_mfa_code_locks_after_too_many_attempts(monkeypatch):
    from app import sms
    from app.config import Settings
    monkeypatch.setattr(Settings, "sms_enabled", property(lambda self: True))
    texts = []
    monkeypatch.setattr(sms, "_send", lambda to, body: texts.append(body) or True)
    client().post("/api/auth/signup", json={"name": "L", "email": "lockmfa@example.com", "password": PW, "confirm_password": PW, "phone": "+14155550122"})
    d = client()
    ticket = d.post("/api/auth/login", json={"email": "lockmfa@example.com", "password": PW}).json()["mfa_ticket"]
    real = texts[-1].split("code is ")[1][:6]
    wrong = "000000" if real != "000000" else "111111"
    for _ in range(5):
        d.post("/api/auth/mfa/verify", json={"ticket": ticket, "code": wrong})
    assert d.post("/api/auth/mfa/verify", json={"ticket": ticket, "code": real}).status_code == 429


def test_db_upgrade_adds_missing_columns(tmp_path):
    from sqlalchemy import create_engine, inspect, text
    from app import db as dbmod
    eng = create_engine(f"sqlite:///{tmp_path}/old.db")
    with eng.begin() as conn:
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(320))"))
    old = dbmod.engine
    dbmod.engine = eng
    try:
        dbmod._add_missing_columns()
    finally:
        dbmod.engine = old
    cols = {c["name"] for c in inspect(eng).get_columns("users")}
    assert {"phone", "mfa_enabled", "phone_verified"} <= cols


def test_assistant_delete_needs_confirmation_and_plans(monkeypatch):
    c = client()
    signup(c, "planner@example.com")
    c.post("/api/transactions", json={"amount": 3000, "category": "Salary", "type": "income"})
    c.post("/api/transactions", json={"amount": 1200, "category": "Rent", "type": "expense", "description": "Rent"})
    c.post("/api/transactions", json={"amount": 400, "category": "Food & Dining", "type": "expense", "description": "Restaurants"})
    c.post("/api/transactions", json={"amount": 4.5, "category": "Food & Dining", "type": "expense", "description": "Blue Bottle Coffee"})

    r = c.post("/api/chat", json={"message": "delete the 4.50 coffee"}).json()
    assert r["type"] == "confirm" and "Blue Bottle" in r["message"]
    action = r["actions"][0]
    assert action["kind"] == "delete_transaction"
    # nothing is deleted until the app confirms
    assert len(c.get("/api/transactions").json()["transactions"]) == 4
    assert c.delete(f"/api/transactions/{action['id']}").status_code == 200

    r = c.post("/api/chat", json={"message": "remove my food budget"}).json()
    assert r["type"] != "confirm"

    plan = c.post("/api/chat", json={"message": "make me a budget plan"}).json()
    assert plan["type"] == "plan" and plan["actions"][0]["kind"] == "apply_budgets"
    budgets = {b["category"]: b["monthly_limit"] for b in plan["actions"][0]["budgets"]}
    assert budgets["Rent"] == 1200 and budgets["Food & Dining"] < 400  # needs kept, wants trimmed

    c.post("/api/savings/goals", json={"name": "Trip", "target_amount": 1200})
    g = c.post("/api/chat", json={"message": "plan my goals"}).json()
    assert "Trip" in g["message"]


def test_settings_preferences_and_validation():
    c = client()
    signup(c, "prefs@example.com")
    r = c.patch("/api/account/profile", json={"currency": "eur", "start_page": "budget", "budget_alert_pct": 80, "savings_target_pct": 25})
    u = r.json()["user"]
    assert (u["currency"], u["start_page"], u["budget_alert_pct"], u["savings_target_pct"]) == ("EUR", "budget", 80, 25)
    assert c.patch("/api/account/profile", json={"currency": "XYZ"}).status_code == 400
    assert c.patch("/api/account/profile", json={"start_page": "admin"}).status_code == 400
    assert c.patch("/api/account/profile", json={"budget_alert_pct": 10}).status_code == 422


def test_change_phone_with_sms_confirmation(monkeypatch):
    from app import sms
    from app.config import Settings
    monkeypatch.setattr(Settings, "sms_enabled", property(lambda self: True))
    texts = []
    monkeypatch.setattr(sms, "_send", lambda to, body: texts.append((to, body)) or True)
    c = client()
    signup(c, "newphone@example.com")
    assert c.post("/api/account/phone", json={"phone": "+14155550999", "password": "wrong"}).status_code == 400
    r = c.post("/api/account/phone", json={"phone": "+1 415 555 0999", "password": PW})
    assert r.json()["verification_sent"] is True and texts[-1][0] == "+14155550999"
    assert r.json()["user"]["phone_masked"] == "•••• 0123"  # unchanged until confirmed
    code = texts[-1][1].split("code is ")[1][:6]
    r = c.post("/api/account/phone/confirm", json={"code": code})
    assert r.json()["user"]["phone_masked"] == "•••• 0999" and r.json()["user"]["phone_verified"] is True
    r = c.post("/api/account/mfa", json={"enabled": False, "password": PW})
    assert r.json()["user"]["mfa_enabled"] is False
    r = c.post("/api/account/mfa", json={"enabled": True, "password": PW})
    assert r.json()["user"]["mfa_enabled"] is True


def test_sessions_list_and_revoke():
    a = client()
    signup(a, "devices@example.com")
    b = client()
    assert b.post("/api/auth/login", json={"email": "devices@example.com", "password": PW}).status_code == 200
    sessions = a.get("/api/account/sessions").json()["sessions"]
    assert len(sessions) == 2 and sum(s["current"] for s in sessions) == 1
    other = next(s for s in sessions if not s["current"])
    assert a.delete(f"/api/account/sessions/{other['id']}").status_code == 200
    assert b.get("/api/auth/me").status_code == 401


def test_subscriptions_manage(monkeypatch):
    from datetime import datetime, timedelta
    from app.db import SessionLocal
    from app.models import Transaction, User
    c = client()
    signup(c, "subs@example.com")
    with SessionLocal() as db:
        uid = db.query(User).filter_by(email="subs@example.com").one().id
        now = datetime.utcnow()
        for m in (0, 1, 2):
            db.add(Transaction(user_id=uid, amount=15.99, category="Entertainment", type="expense", description="NETFLIX.COM", date=now - timedelta(days=30 * m + 1)))
            db.add(Transaction(user_id=uid, amount=60, category="Health", type="expense", description="Gym membership", date=now - timedelta(days=30 * m + 2)))
        db.commit()
    s = c.get("/api/subscriptions").json()
    keys = {d["merchant_key"]: d for d in s["suggestions"]}
    assert "netflix" in keys and s["items"] == []
    # confirm one detection, dismiss the other
    r = c.post("/api/subscriptions", json={"name": "Netflix", "amount": 15.99, "cycle": "monthly", "merchant_key": "netflix",
                                            "source": "detected", "next_date": keys["netflix"]["next_date"]})
    sid = r.json()["subscription"]["id"]
    gym_key = next(k for k in keys if "gym" in k)
    c.post("/api/subscriptions/ignore", json={"merchant_key": gym_key, "name": "Gym membership"})
    c.post("/api/subscriptions", json={"name": "iCloud+", "amount": 35.88, "cycle": "yearly"})
    s = c.get("/api/subscriptions").json()
    assert s["suggestions"] == [] and {i["name"] for i in s["items"]} == {"Netflix", "iCloud+"}
    assert s["totals"]["monthly"] == round(15.99 + 35.88 / 12, 2)
    c.patch(f"/api/subscriptions/{sid}", json={"status": "cancelled"})
    s = c.get("/api/subscriptions").json()
    assert s["totals"]["active"] == 1
    # another user can't touch it
    other = client()
    signup(other, "subs2@example.com")
    assert other.patch(f"/api/subscriptions/{sid}", json={"status": "active"}).status_code == 404


def test_db_upgrade_tolerates_concurrent_add(tmp_path, monkeypatch):
    """If another server instance adds a column first, startup must not crash."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine.reflection import Inspector
    from app import db as dbmod
    eng = create_engine(f"sqlite:///{tmp_path}/race.db")
    with eng.begin() as conn:
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(320), phone VARCHAR(20))"))
    real = Inspector.get_columns
    # Pretend 'phone' was missing when we looked (the other instance added it right after).
    monkeypatch.setattr(Inspector, "get_columns", lambda self, t, **kw: [c for c in real(self, t, **kw) if c["name"] != "phone"])
    old = dbmod.engine
    dbmod.engine = eng
    try:
        dbmod._add_missing_columns()  # must not raise
    finally:
        dbmod.engine = old


# ---------------------------------------------------------------- security hardening

PUBLIC_ROUTES = {
    "/api/health", "/api/auth/config", "/api/auth/signup", "/api/auth/login", "/api/auth/google", "/api/auth/logout",
    "/api/auth/verify-email", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/mfa/verify", "/api/auth/mfa/resend",
    "/api/auth/mfa/email",
}


def test_no_api_route_is_public():
    """Every endpoint except sign-in plumbing must refuse requests without a session."""
    import re
    from fastapi.routing import APIRoute
    c = client()
    checked = []

    def walk(routes):
        for r in routes:
            if isinstance(r, APIRoute):
                yield r
            inner = getattr(getattr(r, "original_router", None), "routes", None) or getattr(r, "routes", None)
            if inner:
                yield from walk(inner)

    for route in walk(app.routes):
        if not route.path.startswith("/api/"):
            continue
        path = re.sub(r"\{[^}]+\}", "1", route.path)
        for method in route.methods - {"HEAD", "OPTIONS"}:
            r = c.request(method, path, json={})
            checked.append((method, route.path, r.status_code))
            if route.path in PUBLIC_ROUTES:
                continue
            if route.path.startswith("/api/internal/"):
                assert r.status_code == 404, (method, route.path, r.status_code)  # hidden without the cron secret
            else:
                assert r.status_code == 401, (method, route.path, r.status_code)
    assert len(checked) > 50


def test_session_expires_after_inactivity():
    from datetime import timedelta
    from app.db import SessionLocal
    from app.models import AuthSession, User, utcnow
    c = client()
    signup(c, "idle@example.com")
    assert c.get("/api/auth/me").status_code == 200
    with SessionLocal() as db:
        uid = db.query(User).filter_by(email="idle@example.com").one().id
        for s in db.query(AuthSession).filter_by(user_id=uid):
            s.last_seen_at = utcnow() - timedelta(minutes=16)
        db.commit()
    r = c.get("/api/auth/me")
    assert r.status_code == 401 and "inactivity" in r.json()["detail"]
    assert c.get("/api/auth/me").status_code == 401  # the session row is gone


def test_activity_keeps_session_alive_and_max_lifetime_enforced():
    from datetime import timedelta
    from app.db import SessionLocal
    from app.models import AuthSession, User, utcnow
    c = client()
    signup(c, "active@example.com")
    with SessionLocal() as db:
        uid = db.query(User).filter_by(email="active@example.com").one().id
        s = db.query(AuthSession).filter_by(user_id=uid).one()
        s.last_seen_at = utcnow() - timedelta(minutes=10)
        db.commit()
    assert c.get("/api/auth/me").status_code == 200  # 10 min idle is still fine, and refreshes last-seen
    with SessionLocal() as db:
        s = db.query(AuthSession).filter_by(user_id=uid).one()
        assert (utcnow() - s.last_seen_at).total_seconds() < 60
        assert (s.expires_at - s.created_at) <= timedelta(hours=12, seconds=5)
        s.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert c.get("/api/auth/me").status_code == 401


def test_phone_number_encrypted_at_rest():
    from sqlalchemy import text
    from app.db import SessionLocal
    c = client()
    signup(c, "encphone@example.com")
    with SessionLocal() as db:
        raw = db.execute(text("SELECT phone, phone_enc FROM users WHERE email = 'encphone@example.com'")).one()
    assert raw[0] is None and raw[1] and "4155550123" not in raw[1]
    assert c.get("/api/auth/me").json()["user"]["phone_masked"] == "•••• 0123"


def test_security_events_and_alerts(monkeypatch):
    from app.routers import account as account_router
    from app.routers import auth as auth_router
    alerts = []
    fake = lambda to, name, title, detail, device: alerts.append(title) or True
    monkeypatch.setattr(auth_router.emails, "send_security_alert", fake)
    monkeypatch.setattr(account_router.emails, "send_security_alert", fake)
    c = client()
    signup(c, "events@example.com")
    client().post("/api/auth/login", json={"email": "events@example.com", "password": "wrong-password"})
    other = client()
    other.headers["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari/604.1"
    assert other.post("/api/auth/login", json={"email": "events@example.com", "password": PW}).status_code == 200
    assert "New sign-in" in alerts
    c.post("/api/account/password", json={"current_password": PW, "new_password": "Brand-New-Passw0rd!"})
    assert "Password changed" in alerts
    kinds = [e["kind"] for e in c.get("/api/account/security-events").json()["events"]]
    assert {"signup", "login", "login_failed", "password_changed"} <= set(kinds)


def test_verification_link_expires():
    from datetime import timedelta
    from app.db import SessionLocal
    from app.models import User, utcnow
    from app.routers import auth as auth_router
    sent = []
    import app.emails as em
    orig = em.send_welcome
    auth_router.emails.send_welcome = lambda to, name, url: sent.append(url) or True
    try:
        signup(client(), "expire@example.com")
    finally:
        auth_router.emails.send_welcome = orig
    token = sent[0].split("#verify=")[1]
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="expire@example.com").one()
        u.verify_expires = utcnow() - timedelta(minutes=1)
        db.commit()
    assert client().post("/api/auth/verify-email", json={"token": token}).status_code == 400


def test_security_headers_on_api():
    r = client().get("/api/health")
    for h in ("X-Frame-Options", "X-Content-Type-Options", "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy", "Referrer-Policy"):
        assert h in r.headers


# ---------------------------------------------------------------- free authenticator MFA

def _enable_totp(c):
    from app import totp
    r = c.post("/api/account/totp/setup", json={"password": PW})
    assert r.status_code == 200 and r.json()["otpauth_url"].startswith("otpauth://totp/Zenty:")
    secret = r.json()["secret"]
    assert c.post("/api/account/totp/enable", json={"code": "000000" if totp.current_code(secret) != "000000" else "111111"}).status_code == 400
    r = c.post("/api/account/totp/enable", json={"code": totp.current_code(secret)})
    assert r.status_code == 200 and len(r.json()["backup_codes"]) == 10
    return secret, r.json()["backup_codes"]


def test_signup_without_phone():
    r = client().post("/api/auth/signup", json={"name": "No Phone", "email": "nophone@example.com", "password": PW, "confirm_password": PW})
    assert r.status_code == 200 and r.json()["user"]["phone_masked"] is None


def test_totp_setup_requires_password_and_secret_is_encrypted():
    from sqlalchemy import text
    from app.db import SessionLocal
    c = client()
    signup(c, "totpenc@example.com")
    assert c.post("/api/account/totp/setup", json={"password": "wrong"}).status_code == 400
    secret, _ = _enable_totp(c)
    with SessionLocal() as db:
        stored = db.execute(text("SELECT totp_secret_enc, backup_codes FROM users WHERE email='totpenc@example.com'")).one()
    assert secret not in stored[0] and stored[0].startswith("gAAAA")
    assert "-" not in stored[1].replace('", "', "")  # only hashes stored, never the codes


def test_login_requires_authenticator_code(monkeypatch):
    import time
    from app import totp
    c = client()
    signup(c, "totplogin@example.com")
    secret, backups = _enable_totp(c)
    d = client()
    r = d.post("/api/auth/login", json={"email": "totplogin@example.com", "password": PW}).json()
    assert r["mfa_required"] and r["methods"] == ["totp", "email", "backup"]
    assert "zenty_session" not in d.cookies
    # next 30-second code (the setup code's step can't be reused)
    code = totp.current_code(secret, time.time() + 30)
    ok = d.post("/api/auth/mfa/verify", json={"ticket": r["mfa_ticket"], "code": code, "method": "totp"})
    assert ok.status_code == 200 and d.cookies.get("zenty_session")
    # the same code can't be replayed
    e = client()
    r2 = e.post("/api/auth/login", json={"email": "totplogin@example.com", "password": PW}).json()
    assert e.post("/api/auth/mfa/verify", json={"ticket": r2["mfa_ticket"], "code": code, "method": "totp"}).status_code == 400


def test_backup_code_works_once_and_email_fallback(monkeypatch):
    from app.routers import auth as auth_router
    sent = []
    monkeypatch.setattr(auth_router.emails, "send_login_code", lambda to, name, code: sent.append(code) or True)
    monkeypatch.setattr(auth_router.emails, "send_security_alert", lambda *a: True)
    c = client()
    signup(c, "totpbackup@example.com")
    _, backups = _enable_totp(c)
    d = client()
    t = d.post("/api/auth/login", json={"email": "totpbackup@example.com", "password": PW}).json()["mfa_ticket"]
    assert d.post("/api/auth/mfa/verify", json={"ticket": t, "code": backups[0].upper().replace("-", " "), "method": "backup"}).status_code == 200
    e = client()
    t = e.post("/api/auth/login", json={"email": "totpbackup@example.com", "password": PW}).json()["mfa_ticket"]
    assert e.post("/api/auth/mfa/verify", json={"ticket": t, "code": backups[0], "method": "backup"}).status_code == 400
    assert e.post("/api/auth/mfa/email", json={"ticket": t}).status_code == 200 and sent
    assert e.post("/api/auth/mfa/verify", json={"ticket": t, "code": sent[-1], "method": "email"}).status_code == 200


def test_totp_wrong_codes_lock_ticket_and_disable_needs_password():
    c = client()
    signup(c, "totplock@example.com")
    _enable_totp(c)
    d = client()
    t = d.post("/api/auth/login", json={"email": "totplock@example.com", "password": PW}).json()["mfa_ticket"]
    for _ in range(5):
        d.post("/api/auth/mfa/verify", json={"ticket": t, "code": "123456", "method": "totp"})
    assert d.post("/api/auth/mfa/verify", json={"ticket": t, "code": "123456", "method": "totp"}).status_code in (400, 429)
    assert c.post("/api/account/totp/disable", json={"password": "wrong"}).status_code == 400
    r = c.post("/api/account/totp/disable", json={"password": PW})
    assert r.json()["user"]["totp_enabled"] is False
    assert client().post("/api/auth/login", json={"email": "totplock@example.com", "password": PW}).json().get("user")
