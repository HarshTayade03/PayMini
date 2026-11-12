# 14 — Guided Rebuild: 16-Milestone Roadmap

This document serves as your personal step-by-step workbook to recreate Paymini completely from scratch. Each milestone contains explicit completion goals, key architectural concepts, and progressive hints.

---

## The 16 Milestones

```
[Milestone 01-04: Infrastructure & Data]
01. Git, Docker Compose, Postgres Container
02. SQLAlchemy 2.0 Models & Integer Minor Units
03. Alembic Database Migration Setup
04. Seed Script & Verification Queries

[Milestone 05-08: Auth & Core Services]
05. Password Hashing (Argon2id) & Security Utility
06. JWT Token Generation & Verification
07. User Registration & Auto-Provisioned Wallet
08. Login Endpoint & Sliding-Window Rate Limiting

[Milestone 09-12: Financial Engine]
09. Wallet Balance & Safe Top-Up Endpoint
10. The Atomic Transfer Transaction & Double-Entry Ledger
11. Request Deduplication via Idempotency Keys (SHA-256)
12. Activity Ledger & Cursor Pagination

[Milestone 13-16: Frontend & Verification]
13. Next.js 14 App Router Scaffold & Tailwind Design Tokens
14. BFF Auth Route Handlers & httpOnly Cookie Jar
15. Send Money Multi-Step Workflow & Test Notice Modal
16. Automated Pytest Suite, Benchmarks & Docker Compose E2E
```

---

## Detailed Milestone Guidance

### Milestone 01: Docker & PostgreSQL Environment
- **Goal:** Launch a healthy PostgreSQL 16 database via Docker Compose with persistent volume storage.
- **Key Files:** `docker-compose.yml`, `.env.example`, `.gitignore`.
- **Hint Ladder:**
  1. *Concept:* Don't install Postgres directly on your local machine; let Docker isolate it.
  2. *Implementation:* Define a `db` service using `postgres:16-alpine` and mount a named volume `postgres_data:/var/lib/postgresql/data`.
  3. *Verification:* Run `docker compose up -d db` and connect via `pg_isready`.

### Milestone 02: SQLAlchemy Models & Integer Minor Units
- **Goal:** Define `User`, `Wallet`, `Transfer`, `LedgerEntry`, and `IdempotencyKey` without using floats.
- **Key Files:** `backend/app/models/models.py`.
- **Hint Ladder:**
  1. *Concept:* Money must be stored in minor units (`BigInteger` or `Integer` paise).
  2. *Relationships:* A `User` has one `Wallet`. A `Wallet` has many `LedgerEntry` records.
  3. *Immutability:* Ledger entries should never have an `updated_at` column.

### Milestone 03: Alembic Migrations
- **Goal:** Generate and apply the initial schema migration version file.
- **Key Files:** `backend/alembic.ini`, `backend/alembic/env.py`.
- **Hint Ladder:**
  1. *Concept:* Never use `Base.metadata.create_all()` in production; migrations provide tracked version history.
  2. *Configuration:* In `env.py`, import `Base` and assign `target_metadata = Base.metadata`.
  3. *Execution:* Run `alembic revision --autogenerate -m "create initial schema"` followed by `alembic upgrade head`.

### Milestone 04: Seed Script & Verification
- **Goal:** Write a Python script to populate two test users with starting balances.
- **Key Files:** `backend/scripts/seed.py`.
- **Hint:** Use `SessionLocal()` directly, hash passwords with your security utility, and create both a wallet and an initial CREDIT ledger entry.

### Milestone 05: Password Hashing (Argon2id)
- **Goal:** Implement secure hashing and verification using `passlib[argon2]`.
- **Key Files:** `backend/app/core/security.py`.
- **Hint:** Configure `CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")`.

### Milestone 06: JWT Signing & Token Verification
- **Goal:** Implement access token generation and FastAPI dependency for extracting the current active user.
- **Key Files:** `backend/app/core/security.py`, `backend/app/api/deps.py`.
- **Hint:** Use `python-jose` to encode `sub`, `exp`, and `iat`. In `get_current_user`, catch `JWTError` and raise `401 Unauthorized`.

### Milestone 07: User Registration
- **Goal:** Endpoint `POST /api/v1/auth/register` creating user, wallet, and initial bonus credit atomically.
- **Key Files:** `backend/app/api/v1/endpoints/auth.py`.
- **Hint:** Wrap user creation, wallet creation, and the initial ₹100 CREDIT ledger entry in a single `with db.begin():` block.

### Milestone 08: Login Endpoint & In-Memory Rate Limiter
- **Goal:** Authenticate credentials and prevent brute-force attacks.
- **Key Files:** `backend/app/core/rate_limiter.py`.
- **Hint:** Use an in-memory dictionary storing timestamps of recent attempts per client IP. Reject with `429` if count exceeds 5 in 60 seconds.

### Milestone 09: Wallet Balance & Top-Up
- **Goal:** `GET /api/v1/wallet` and `POST /api/v1/wallet/top-up`.
- **Key Files:** `backend/app/api/v1/endpoints/wallet.py`.
- **Hint:** Enforce per-request limits (₹10,000) and daily rolling caps (₹50,000) using Pydantic validators and SQL sum filters.

### Milestone 10: Atomic Peer-to-Peer Transfer
- **Goal:** `POST /api/v1/transfers` executing double-entry deduction and credit atomically.
- **Key Files:** `backend/app/api/v1/endpoints/transfers.py`.
- **Hint:** Prevent self-transfers (`sender.id == recipient.id`). Deduct sender, credit recipient, flush for `transfer.id`, and append debit/credit ledger entries.

### Milestone 11: Idempotency Verification
- **Goal:** Deduplicate repeated transfer requests with `Idempotency-Key` header.
- **Key Files:** `backend/app/api/v1/endpoints/transfers.py`.
- **Hint:** Hash canonicalized request JSON with SHA-256. Replay cached response on identical payload; return `422` on payload mismatch.

### Milestone 12: Activity Ledger & Cursor Pagination
- **Goal:** `GET /api/v1/transactions` with cursor-based pagination.
- **Key Files:** `backend/app/api/v1/endpoints/transactions.py`.
- **Hint:** Avoid `OFFSET`. Fetch rows where `created_at < cursor_timestamp ORDER BY created_at DESC LIMIT limit + 1` to detect `has_more`.

### Milestone 13: Next.js Scaffold & Design Tokens
- **Goal:** Initialize Next.js 14 App Router and configure calm financial design tokens in Tailwind.
- **Key Files:** `frontend/tailwind.config.js`, `frontend/app/globals.css`.
- **Hint:** Define tokens for `primary`, `neutral`, `success`, and `error`. Use `font-variant-numeric: tabular-nums` for currency figures.

### Milestone 14: BFF Route Handlers & Secure Cookies
- **Goal:** Next.js route handlers that seal JWTs inside `httpOnly` cookies.
- **Key Files:** `frontend/app/api/auth/login/route.ts`, `frontend/app/api/proxy/[...path]/route.ts`.
- **Hint:** Set cookies with `httpOnly: true`, `secure: true`, `sameSite: 'lax'`. The proxy reads the cookie and attaches `Authorization: Bearer <token>` to backend calls.

### Milestone 15: Send Money Multi-Step Flow
- **Goal:** Build the transfer UI with Input $\rightarrow$ Review $\rightarrow$ Submit $\rightarrow$ Success Receipt states.
- **Key Files:** `frontend/app/send/page.tsx`, `frontend/components/TestNoticeModal.tsx`.
- **Hint:** Generate a UUID for `Idempotency-Key` on component mount, and pass it during form submission.

### Milestone 16: Automated Testing & Verification
- **Goal:** Write comprehensive pytest suite and verify Docker Compose end-to-end.
- **Key Files:** `backend/tests/test_auth.py`, `backend/tests/test_wallet.py`, `backend/tests/test_transfers.py`.
- **Hint:** Use SQLite in-memory engine with `StaticPool` for fast sub-second test execution.
