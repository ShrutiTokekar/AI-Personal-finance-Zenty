<div align="center">

<img src="frontend/public/zenty-logo.png" alt="Zenty logo" width="140"/>

# Zenty
### Personal finance, minus the stress

**[www.zentyai.com](https://www.zentyai.com)**

[![CI](https://github.com/ShrutiTokekar/AI-Personal-finance-Zenty/actions/workflows/ci.yml/badge.svg)](https://github.com/ShrutiTokekar/AI-Personal-finance-Zenty/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-3.12-3776ab?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Postgres](https://img.shields.io/badge/Database-Postgres-4169e1?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Hosted-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)

</div>

---

Zenty brings your spending, budgets, savings goals, subscriptions and investments into one calm
place. Link your bank safely, see where your money goes, and get a simple plan for what to do next.

## Features

**Money at a glance**
- **Dashboard** with a Zen Score, "safe to spend today", monthly money in/out, insights and a spending calendar
- **Transactions** from linked banks, sorted by account type (checking, credit, savings), plus manual entries
- **Budgets** by category with progress bars and over-budget alerts
- **Goals** for savings, with progress and target dates
- **Subscriptions**: finds recurring charges, shows what you pay per month and year, and shows what renews next
- **Investments**: track stocks with live quotes and a daily email when they move
- **Insights**: monthly trends, category breakdowns and a spending calendar heat map

**Ask Zenty assistant**
- Available on every page. Add or delete transactions in plain English ("spent 12 on coffee")
- Suggests budget and savings-goal plans based on your own numbers
- Runs on simple built-in rules: fast, private and free. No outside AI service sees your data

**Accounts and emails**
- Sign in with Google or email and password
- Welcome email with an email confirmation link
- Security alert emails for new sign-ins, password changes and resets, backup-code use and two-step sign-in changes
- Settings for profile, personalization, budgeting defaults, alerts, security activity, data export and account deletion

**Landing page**
- Animated zen-garden hero where a rake draws three lines and feature cards appear
- About section, and a guide that answers questions about features and signing up
- [Privacy Policy](https://www.zentyai.com/privacy) and [Terms of Service](https://www.zentyai.com/terms)

## Security

Security is the core of Zenty. These are the same layers banks and fintech apps use.

| Area | What Zenty does |
|---|---|
| **Bank linking** | Users log in to their bank inside **Plaid Link**. Zenty never sees bank passwords. Plaid access tokens are encrypted (Fernet, AES + HMAC) and never reach the browser |
| **Passwords** | Argon2id hashing, strength rules, lockout after 5 failed tries, rate limits per IP and per email |
| **Two-step sign-in (free)** | Authenticator app codes (Google Authenticator, Apple Passwords, 1Password and others). Single-use backup codes and an emailed code as fallbacks. Secrets encrypted, backup codes stored only as hashes, codes can't be reused |
| **Sessions** | Random tokens in `__Host-` `httpOnly; Secure; SameSite=Strict` cookies. Only a hash is stored. **Signs out after 15 minutes of no activity** (with a 2-minute warning) and after 12 hours at most |
| **Requests** | CSRF double-submit token plus a required custom header on every change. Every row is owned by a user; other users' data returns 404 |
| **No public APIs** | Every route needs a signed-in session, except sign-in/sign-up and cron jobs (protected by a secret). A test fails the build if a new route is left open |
| **Encryption** | Bank tokens, phone numbers and authenticator secrets are encrypted in the database. Postgres is encrypted at rest; everything is HTTPS with HSTS |
| **Headers** | Strict Content Security Policy, `X-Frame-Options: DENY`, `no-store` caching on API responses. API docs are off in production and errors never leak internals |
| **Monitoring** | Security activity log users can see (no IP addresses stored, kept 180 days) and email alerts for important changes |
| **Supply chain** | GitHub Actions runs tests, `pip-audit`, `npm audit` and a gitleaks secret scan on every push. Dependabot keeps packages up to date. All dependencies pinned |
| **Your rights** | Download all your data or permanently delete your account, which also revokes bank access at Plaid |

No system is "unhackable". Keep secrets only in Vercel environment variables, rotate any key
that's ever exposed, and turn on two-step sign-in for GitHub, Vercel, Neon, Plaid, Resend and Google Cloud.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide icons |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Argon2, cryptography (Fernet) |
| Database | Neon Postgres (SQLite locally) |
| Services | Plaid (banks), Resend (email), Google Identity (sign-in), Twilio (optional texts) |
| Hosting | Vercel: static frontend and a Python serverless API on one domain, plus Vercel Cron |

The backend installs at about 60 MB. Version 1 used about 1 GB of machine-learning libraries, now removed.

## Project layout

```
api/index.py            Vercel entry point for the API
backend/app/
  main.py               App setup, security headers, startup DB upgrade
  routers/              auth, account, finance, bank, subscriptions, internal (cron)
  security.py           Passwords, sessions, CSRF, rate limits, encryption
  totp.py               Authenticator codes (RFC 6238) and backup codes
  assistant.py          Rule-based "Ask Zenty" assistant
  emails.py             Welcome, verify, alerts and stock digest emails
backend/tests/          API and security tests
frontend/src/components Landing, Auth, Dashboard, Transactions, Budget, Savings,
                        Subscriptions, Stocks, Analytics, Settings, Legal, Assistant
vercel.json             Build, routing, security headers and cron schedule
```

## Run locally

```bash
# API
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env            # everything is optional locally
.venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
# Frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Without `RESEND_API_KEY`, emails are skipped and written to the server log (including verify links).

```bash
# Tests
cd backend && .venv/bin/pip install pytest && .venv/bin/python -m pytest -q
```

## Deploy (free) on Vercel

1. **Database:** Vercel → Storage → Create → **Neon Postgres** (free). It adds `DATABASE_URL`. Use the pooled connection string.
2. **Project settings:** Root Directory is the repository root, not `frontend`.
3. **Environment variables (Production):** everything in [`backend/.env.example`](backend/.env.example), with `ZENTY_ENV=production` and `APP_URL=https://<your-domain>`. Generate `ZENTY_ENCRYPTION_KEY` and `CRON_SECRET` with the commands in that file.
4. **Google:** add `https://<your-domain>` to the OAuth client's *Authorized JavaScript origins*.
5. **Resend:** verify your sending domain, then set `EMAIL_FROM=Zenty <hello@yourdomain.com>`.
6. **Plaid:** start with `PLAID_ENV=sandbox` (test login `user_good` / `pass_good`). Apply for production access before real users link real banks.
7. **Push to GitHub.** Vercel builds the frontend and deploys `api/index.py`. New database columns are added automatically on startup.

Scheduled jobs (Vercel Cron): stock digest on weekdays at 21:30 UTC, and a daily cleanup of expired sessions and old logs.

Two-step sign-in works for free with authenticator apps. Twilio keys are only needed if you also want texted codes.

`backend/Dockerfile` runs the same API on Cloud Run, AWS App Runner and similar hosts if you outgrow Vercel.

## License

© Zenty. All rights reserved.
