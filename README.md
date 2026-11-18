# PayMini - Peer-to-Peer Digital Wallet (Learning Simulation)

> **IMPORTANT NOTICE: DEMO & LEARNING SIMULATION ONLY**  
> This application is an educational simulation built for software engineering learning and interview preparation. All balances, deposits, and transfers use **fake test currency (INR paise)**. No real payment gateways, credit cards, or banking APIs are integrated. No real card numbers or payment credentials should ever be entered into this system.

---

## Overview

PayMini is a full-stack peer-to-peer (P2P) digital wallet application designed with clean architecture, strict database transactional guarantees, and modern web security practices:

- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, PostgreSQL 16, Alembic, pytest.
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide icons.
- **Infrastructure:** Docker Compose (FastAPI + Next.js + PostgreSQL), GitHub Actions CI.
- **Security:** Argon2id password hashing, JWT access tokens sealed in `httpOnly` `SameSite=Lax` cookies via a Next.js Backend-For-Frontend (BFF) proxy, parameterized SQL queries, sliding-window rate limiting, and zero direct exposure of auth tokens to browser JavaScript.

---

## Architecture

```text
[ Browser (Chrome / Firefox / Safari) ]
              |
              | (HTTPS requests with httpOnly, Secure, SameSite=Lax Cookie)
              v
[ Next.js Frontend (Port 3000) ]  <-- BFF Layer: Route Handlers & SSR
              |
              | (Internal API calls with Authorization: Bearer <JWT>)
              v
[ FastAPI Backend (Port 8000) ]   <-- Input Validation, Rate Limiter, Business Rules, Idempotency
              |
              | (SQLAlchemy 2.0 Parameterized Queries inside ACID Transactions)
              v
[ PostgreSQL 16 (Port 5432) ]     <-- Append-Only Ledger, Wallets, Transfers, Users
```

---

## Key Features & Financial Design

1. **Integer Minor-Unit Currency:** All money calculations operate strictly on integers (`paise`, where `100 paise = ₹1.00`). Floating-point arithmetic is banned to prevent IEEE 754 precision inaccuracies.
2. **Double-Entry Append-Only Ledger:** Every peer-to-peer transfer writes an immutable debit entry for the sender, a credit entry for the recipient, and a transfer record within a single atomic database transaction. Ledger rows are never updated or deleted.
3. **Idempotency Protection:** Transfer mutations accept an `Idempotency-Key` header with SHA-256 payload fingerprinting to prevent duplicate debits during network retries or client double-clicks.
4. **Backend-For-Frontend (BFF) Cookie Isolation:** Browser JavaScript cannot read or exfiltrate the JWT (`document.cookie` is empty), neutralizing client-side token theft via XSS.
5. **Context-Derived Ownership (IDOR Immunity):** Endpoints never accept an account or wallet ID from user input. The backend strictly resolves the authenticated user's wallet directly from the verified cryptographic token subject.

---

## Quick Start (Docker Compose)

Run the entire application locally with a single command:

```bash
# 1. Copy the environment template
cp .env.example .env

# 2. Build and start all services
docker compose up --build
```

Access the services:
- **Frontend Application:** [http://localhost:3000](http://localhost:3000)
- **FastAPI OpenAPI Interactive Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## Local Development Setup

### Backend (Python 3.12+)
```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\Activate.ps1
# macOS / Linux:
# source venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
pytest -v
uvicorn app.main:app --reload --port 8000
```

### Frontend (Node.js 20+)
```bash
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

---

## API Summary

Versioned under `/api/v1` with automatic OpenAPI documentation:

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service and database health status | No |
| `POST` | `/api/v1/auth/register` | Register new user + provision starter wallet | No |
| `POST` | `/api/v1/auth/login` | Authenticate credentials (rate-limited) | No |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile | Yes (Bearer) |
| `GET` | `/api/v1/wallet` | Fetch current wallet balance | Yes (Bearer) |
| `POST` | `/api/v1/wallet/top-up` | Add simulation funds (capped) | Yes (Bearer) |
| `POST` | `/api/v1/transfers` | Send funds to recipient (supports `Idempotency-Key`) | Yes (Bearer) |
| `GET` | `/api/v1/transactions` | Query ledger history with cursor pagination | Yes (Bearer) |

---

## Automated Testing

The backend includes a comprehensive pytest suite covering auth validation, IDOR protection, ledger invariants ($\sum \text{Debit} = \sum \text{Credit}$), top-up limits, and idempotency deduplication:

```bash
docker run --rm -v "%cd%/backend:/app" paymini-backend-dev pytest -v
```
*(15 integration tests passing across all financial invariants)*

---

## License

This project is licensed under the MIT License. Built for educational and interview preparation purposes.
