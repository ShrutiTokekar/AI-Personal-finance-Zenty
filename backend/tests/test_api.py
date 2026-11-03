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
    r = c.post("/api/auth/signup", json={"name": name, "email": email, "password": PW})
    assert r.status_code == 200, r.text
    c.headers["X-CSRF-Token"] = c.cookies.get("zenty_csrf")
    return r.json()["user"]


@pytest.fixture(scope="module", autouse=True)
def _startup():
    with TestClient(app):
        yield


def test_signup_sets_httponly_cookie_and_hides_hash():
    c = client()
    r = c.post("/api/auth/signup", json={"name": "A", "email": "a@example.com", "password": PW})
    assert r.status_code == 200
    set_cookie = r.headers.get_list("set-cookie")
    session = [h for h in set_cookie if h.startswith("zenty_session=")][0]
    assert "HttpOnly" in session and "SameSite=strict" in session
    assert "password" not in r.text.lower().replace("has_password", "")


def test_weak_password_rejected():
    r = client().post("/api/auth/signup", json={"name": "W", "email": "w@example.com", "password": "password"})
    assert r.status_code == 400


def test_duplicate_email_rejected():
    c = client()
    signup(c, "dup@example.com")
    r = client().post("/api/auth/signup", json={"name": "B", "email": "DUP@example.com", "password": PW})
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
            "/accounts/get": {"item": {}, "accounts": [{"account_id": "acc-1", "name": "Checking", "mask": "1234",
                                                        "type": "depository", "balances": {"current": 900.0}}]},
            "/transactions/sync": {"added": [{"transaction_id": "t1", "amount": 12.0, "date": "2026-10-30",
                                              "name": "Coffee", "personal_finance_category": {"primary": "FOOD_AND_DRINK"}}],
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
    assert any(t["source"] == "bank" for t in c.get("/api/transactions").json()["transactions"])


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
