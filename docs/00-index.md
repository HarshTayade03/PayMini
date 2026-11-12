# Documentation Index & Roadmap

Welcome to the **PayMini** technical documentation and interview preparation guide. This repository simulates a production-grade peer-to-peer (P2P) digital wallet application built with **FastAPI, PostgreSQL, SQLAlchemy 2.0, Alembic, Next.js (App Router), and Tailwind CSS**.

The target audience for these documents is a motivated computer science undergraduate preparing for competitive software engineering internship interviews (e.g., PayPal, Stripe, Razorpay).

---

## Document Map & Estimated Reading Order

| # | Document | Primary Focus & Core Concepts | Est. Reading Time |
| :--- | :--- | :--- | :--- |
| **01** | [01-overview-and-architecture.md](01-overview-and-architecture.md) | High-level architecture, request lifecycle, BFF design, folder structure tour | 12 mins |
| **02** | [02-data-model-and-ledger.md](02-data-model-and-ledger.md) | ASCII ER diagram, append-only double-entry ledger, IEEE 754 float traps, migrations | 15 mins |
| **03** | [03-auth-and-security.md](03-auth-and-security.md) | Argon2id hashing, JWT, httpOnly cookies vs localStorage, CORS, CSRF, IDOR | 18 mins |
| **04** | [04-transfers-and-transactions.md](04-transfers-and-transactions.md) | ACID in code, database transactions, line-by-line transfer walkthrough, failure handling | 15 mins |
| **05** | [05-idempotency.md](05-idempotency.md) | The double-charge problem, SHA-256 payload hashing, idempotency key table design | 12 mins |
| **06** | [06-api-reference.md](06-api-reference.md) | Complete endpoint specifications, curl examples, HTTP status code taxonomy | 10 mins |
| **07** | [07-frontend-guide.md](07-frontend-guide.md) | Design tokens, Next.js App Router, BFF proxying, accessible modal dialogs | 12 mins |
| **08** | [08-testing.md](08-testing.md) | Automated pytest suite, IDOR verification, single-threaded ledger invariant tests | 10 mins |
| **09** | [09-deployment-free.md](09-deployment-free.md) | Zero-cost deployment guide (Vercel + Railway/Render + Supabase/Neon), cold starts | 14 mins |
| **10** | [10-after-launch.md](10-after-launch.md) | Smoke testing, structured logs, uptime checks, credential leak mitigation | 10 mins |
| **11** | [11-known-limitations-and-concurrency.md](11-known-limitations-and-concurrency.md) | **Crucial Interview Topic**: Race condition timeline, lost updates, row locking fixes | 20 mins |
| **12** | [12-interview-prep.md](12-interview-prep.md) | **Interview War Chest**: 30s/2m/5m pitches, 40+ technical Q&As, PayPal system design | 25 mins |
| **13** | [13-glossary.md](13-glossary.md) | 1-line rapid definitions for all system and financial terms | 8 mins |
| **14** | [14-rebuild-it-yourself.md](14-rebuild-it-yourself.md) | Milestone-by-milestone guided rebuild roadmap with hints ladder and v2 upgrades | 20 mins |
| **15** | [15-reading-list.md](15-reading-list.md) | Official documentation curriculum and high-yield reading order | 8 mins |
| **Log** | [decision-log.md](decision-log.md) | Architecture Decision Records (ADRs) explaining choices & alternatives | 10 mins |
| **Sec** | [security-checklist.md](security-checklist.md) | Pre-deployment security verification audit & OWASP Top 10 matrix | 10 mins |
| **Perf**| [benchmarks.md](benchmarks.md) | Measured throughput and latency numbers across endpoints | 5 mins |

---

## Recommended Learning Paths

### Path A: The 1-Hour Interview Sprint
1. Start with [01-overview-and-architecture.md](01-overview-and-architecture.md) for the end-to-end mental model.
2. Read [02-data-model-and-ledger.md](02-data-model-and-ledger.md) to master integer currency and double-entry accounting.
3. Read [11-known-limitations-and-concurrency.md](11-known-limitations-and-concurrency.md) to answer concurrency questions with confidence.
4. Drill [12-interview-prep.md](12-interview-prep.md) for 40+ tested questions and the "Design PayPal Send Money" system design breakdown.

### Path B: The Deep Builder Journey
- Read [00-index.md](00-index.md) through [10-after-launch.md](10-after-launch.md) sequentially.
- Study [14-rebuild-it-yourself.md](14-rebuild-it-yourself.md) to recreate the entire architecture from scratch in 16 structured milestones.
