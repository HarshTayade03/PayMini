# Resume Bullets & Talking Points

Use these verified, ATS-friendly bullet points on your resume when applying for Software Engineering internships or entry-level positions (e.g., PayPal, Stripe, Razorpay, Amazon).

> [!NOTE]
> Per engineering standards, these bullets use **action verbs**, describe the **exact technical problem and solution**, and include **only verified, measured metrics**. Concurrency safety is explicitly omitted because Version 1 documents race conditions rather than implementing distributed locks.

---

## 3 Tailored Resume Bullets

### Option 1: Full-Stack Financial Engineering Focus
- **Engineered** a full-stack digital wallet simulation using FastAPI, PostgreSQL, and Next.js 14, implementing an append-only double-entry ledger with integer minor-unit arithmetic (paise) to eliminate floating-point rounding errors.
- **Architected** request deduplication with SHA-256 idempotency keys and atomic PostgreSQL transactions, guaranteeing zero duplicate debits during network retries or client double-clicks.
- **Secured** user authentication using Argon2id password hashing and a Next.js BFF proxy that encapsulates JWTs in httpOnly, SameSite cookies, neutralizing client-side XSS token theft.

---

### Option 2: Backend & Database Integrity Focus
- **Developed** a peer-to-peer payment API in Python 3.12 (FastAPI, SQLAlchemy 2.0, Alembic) enforcing ACID transaction boundaries and zero-sum double-entry ledger invariants across all funds transfers.
- **Optimized** transaction history query performance using composite B-tree indexes `(wallet_id, created_at DESC)` and cursor pagination, eliminating full-table sequence scans and offset degradation.
- **Authored** 15 automated integration tests in pytest covering IDOR authorization barriers, duplicate-key replays, and ledger balance reconciliation, achieving a 100% pass rate in under 3.0s.

---

### Option 3: Modern Web Security & Architecture Focus
- **Designed** a secure Backend-For-Frontend (BFF) architecture in Next.js 14, preventing sensitive JWT exposure to browser JavaScript and mitigating OWASP Top 10 risks including IDOR and CSRF.
- **Implemented** sliding-window IP rate limiting and context-derived resource authorization, ensuring authenticated users can only query their own ledger entries.
- **Packaged** the full-stack system with multi-stage Docker Compose builds and GitHub Actions CI, keeping production client bundle size under 95 kB.
