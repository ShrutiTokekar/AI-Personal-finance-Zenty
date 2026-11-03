<div align="center">

<img src="/frontend/public/logo.png" alt="Zenty Finance Logo" width="160"/>

# Zenty Finance
### Personal finance, minus the stress

[![Python](https://img.shields.io/badge/Python-3.12-3776ab?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Postgres](https://img.shields.io/badge/Database-Postgres-4169e1?style=flat-square&logo=postgresql)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)

</div>

---

Track spending, budgets, savings goals and stocks, and securely link bank accounts.
Sign in with Google or email. New users get a welcome email, and investors get a daily
email when their stocks move.

## What changed in v2

| | v1 | v2 |
|---|---|---|
| Backend install size | ~1 GB (PyTorch, Transformers, spaCy, pandas, scikit-learn) | ~60 MB |
| Accounts | None. Everyone shared one database | Per-user accounts, email + Google sign-in |
| Data storage | SQLite file on Hugging Face (public Space, wiped on restart) | Managed Postgres (Neon), encrypted at rest |
| Assistant | Local ML models, ~1 min cold start | Instant rule-based assistant |
| Stock prices | yfinance + pandas; the stocks page showed random prices | Live quotes via a lightweight HTTP call |
| Bank data | n/a | Plaid Link; tokens encrypted server-side |
| Hosting | Hugging Face Space + Vercel | Vercel only (frontend + API on one domain, free) |

## Security model

- **Bank logins never touch Zenty.** Users sign in to their bank inside Plaid Link. Plaid returns
  an access token to our server only. It's encrypted with Fernet (AES + HMAC) using
  `ZENTY_ENCRYPTION_KEY` and is never sent to the browser or returned by any endpoint.
  We store only account name, last 4 digits and balances.
- **Every row has an owner.** All queries filter by the signed-in user; requests for another
  user's data return 404. Bank linking also requires a verified email.
- **Passwords** are hashed with Argon2id. Strength rules apply, accounts lock for 15 minutes
  after 5 failures, and login/signup/reset are rate-limited per IP and per email.
- **Sessions** are random tokens in `httpOnly; Secure; SameSite=Strict` cookies. Only a SHA-256
  hash is stored server-side, so a database leak can't be used to log in. Logout, password
  change and password reset revoke sessions.
- **CSRF**: double-submit token plus a required custom header on every write.
- **Google sign-in**: ID tokens are verified against Google's public keys, audience and issuer.
- **Headers**: strict CSP, HSTS, `X-Frame-Options: DENY`, `Cache-Control: no-store` on API
  responses. API docs are disabled in production; errors never leak internals.
- **Your rights**: users can download all their data and permanently delete their account,
  which also revokes bank access at Plaid.

No system is "unhackable". These are the same layers banks and fintech apps rely on. Keep
secrets only in Vercel environment variables, rotate them if exposed, and enable 2FA on
GitHub, Vercel, Neon, Plaid, Resend and Google Cloud.

## Run locally

```bash
# API
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env            # fill in what you have; everything is optional locally
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Without `RESEND_API_KEY`, emails are skipped and logged. To verify an email locally, check the
server log or set `email_verified` in the SQLite DB.

Tests: `cd backend && .venv/bin/pip install pytest && .venv/bin/python -m pytest -q`

## Deploy (free) on Vercel

1. **Database**: in Vercel → Storage → *Create* → **Neon Postgres** (free). It adds `DATABASE_URL`
   automatically. Use the *pooled* connection string.
2. **Project settings**: Root Directory = repository root (not `frontend`).
3. **Environment variables** (Production): everything in `backend/.env.example`, with
   `ZENTY_ENV=production` and `APP_URL=https://<your-domain>`.
4. **Google**: in your OAuth client add `https://<your-domain>` to *Authorized JavaScript origins*.
5. **Resend**: verify your sending domain, then set `EMAIL_FROM=Zenty <hello@yourdomain.com>`.
6. **Plaid**: start with `PLAID_ENV=sandbox` (test user `user_good` / `pass_good`). Apply for
   production access in the Plaid dashboard before real users link real banks.
7. Push to GitHub. Vercel builds the frontend and deploys `api/index.py` as a serverless function.
   Vercel Cron sends the stock digest on weekdays at 21:30 UTC, after US market close.

`backend/Dockerfile` lets you run the same API on Cloud Run, AWS App Runner, etc. if you outgrow Vercel.
