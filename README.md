# PayMini - Peer-to-Peer Digital Wallet (Learning Simulation)

> **IMPORTANT NOTICE: DEMO & LEARNING SIMULATION ONLY**
> This application is an educational simulation built for software engineering interviews and learning purposes. All balances, deposits, and transfers use **fake test currency (INR paise)**. No real payment gateways, credit cards, or banking APIs are integrated. No real card numbers or payment credentials should ever be entered into this system.

---

## Overview

PayMini is a full-stack peer-to-peer (P2P) digital wallet application built with:
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, PostgreSQL, Alembic, pytest.
- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide icons.
- **Infrastructure:** Docker Compose (FastAPI + Next.js + PostgreSQL), GitHub Actions CI.
- **Security:** Argon2 password hashing, JWT stored in `httpOnly` `SameSite=Lax` cookies, parameterized queries, strict server-side validation, and zero exposure of internal tokens to browser JavaScript.

---

## Architecture at a Glance

```text
[ Browser (Chrome/Firefox/Safari) ]
              |
              | (HTTP requests with httpOnly Cookie)
              v
[ Next.js Frontend (Port 3000) ]  <-- App Router & Server Route Handlers
              |
              | (Internal API requests with Bearer JWT)
              v
[ FastAPI Backend (Port 8000) ]   <-- Validation, Auth, Business Rules, Idempotency
              |
              | (SQLAlchemy 2.0 Parameterized Queries inside ACID Transactions)
              v
[ PostgreSQL 16 (Port 5432) ]     <-- Append-only Ledger, Wallets, Transfers, Users
```

---

## Quick Start (Docker Compose)

Run the entire application with a single command:

```bash
# 1. Copy the environment template
cp .env.example .env

# 2. Build and start all services
docker compose up --build
```

Access the services:
- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **FastAPI OpenAPI Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## Local Development Setup

### Backend (Python 3.12+)
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
pytest
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

## Core Financial Design Principles

1. **Integer Money Representation:** All monetary amounts are handled strictly as integer minor units (`paise`, where `100 paise = ₹1.00`). Floating-point arithmetic is banned in money calculation to avoid IEEE 754 precision inaccuracies.
2. **Double-Entry Append-Only Ledger:** Transfers record an immutable debit entry for the sender and a credit entry for the recipient within a single database transaction. Ledger rows are never updated or deleted.
3. **Idempotency Safeguard:** Transfer requests accept an `Idempotency-Key` header with payload hash checking to prevent double-charging on client retries or rapid double-clicks.
4. **Explicit Known Limitations:** Concurrency race conditions (such as concurrent requests racing the balance check) are intentionally left unmitigated in version 1 for clear educational inspection. Comprehensive remediation strategies (row locking `SELECT FOR UPDATE`, optimistic locking, serializable transactions) are thoroughly documented in [docs/11-known-limitations-and-concurrency.md](docs/11-known-limitations-and-concurrency.md).

---

## Documentation Index

Explore the complete technical and interview documentation in the [`/docs`](docs/00-index.md) folder:
- [00-index.md](docs/00-index.md) - Documentation roadmap and estimated reading times.
- [01-overview-and-architecture.md](docs/01-overview-and-architecture.md) - Architecture, request lifecycle, and component tours.
- [02-data-model-and-ledger.md](docs/02-data-model-and-ledger.md) - ER diagrams, double-entry ledger design, and floating-point risks.
- [03-auth-and-security.md](docs/03-auth-and-security.md) - Argon2 hashing, JWT via httpOnly cookies, CORS, and OWASP Top 10.
- [04-transfers-and-transactions.md](docs/04-transfers-and-transactions.md) - ACID mechanics and line-by-line transfer walkthrough.
- [05-idempotency.md](docs/05-idempotency.md) - Preventing duplicate payments on network retries.
- [06-api-reference.md](docs/06-api-reference.md) - Complete endpoints, curl examples, and error specifications.
- [07-frontend-guide.md](docs/07-frontend-guide.md) - Design tokens, Next.js architecture, and accessibility features.
- [08-testing.md](docs/08-testing.md) - Pytest suite structure, IDOR protection tests, and CI runs.
- [09-deployment-free.md](docs/09-deployment-free.md) - Zero-cost production deployment guide (Vercel + Render/Railway + Supabase/Neon).
- [10-after-launch.md](docs/10-after-launch.md) - Observability, smoke testing, log reading, and secret rotation.
- [11-known-limitations-and-concurrency.md](docs/11-known-limitations-and-concurrency.md) - Race condition timelines, lock ordering, and Version 2 roadmap.
- [12-interview-prep.md](docs/12-interview-prep.md) - 40+ engineering interview Q&As, PayPal system design, and pitches.
- [13-glossary.md](docs/13-glossary.md) - Clear 1-line definitions for every domain term.
- [14-rebuild-it-yourself.md](docs/14-rebuild-it-yourself.md) - Step-by-step milestone guide to recreate this stack from scratch.
- [15-reading-list.md](docs/15-reading-list.md) - Curated official documentation and learning references.
- [decision-log.md](docs/decision-log.md) - Architectural decision records (ADRs).
- [security-checklist.md](docs/security-checklist.md) - Pre-deployment security verification audit.
