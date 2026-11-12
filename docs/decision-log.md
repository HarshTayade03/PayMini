# Engineering Decision Log (ADR)

This document tracks all meaningful architectural, engineering, and technical trade-off decisions made during the design and development of PayMini.

---

## ADR-001: Token Handling via httpOnly Cookies vs. localStorage

- **Context:** The frontend needs to authenticate requests to the backend. In single-page applications, tokens are often stored either in browser `localStorage` or inside secure, HTTP-only cookies.
- **Decision:** The Next.js frontend issues/relays JWTs stored strictly inside an `httpOnly`, `Secure` (in production), `SameSite=Lax` cookie. Browser client-side JavaScript never has access to the token string (`document.cookie` cannot read `httpOnly` cookies). Next.js Route Handlers act as a secure proxy / BFF (Backend for Frontend).
- **Alternative:** Storing JWT in `localStorage` or `sessionStorage` and passing it via an `Authorization: Bearer <token>` header attached by client JavaScript.
- **Reason:** Storing sensitive access tokens in `localStorage` leaves them immediately vulnerable to Cross-Site Scripting (XSS). If any third-party script, injected script, or compromised dependency executes in the browser context, it can read `localStorage.getItem("token")` and exfiltrate credentials. With an `httpOnly` cookie, script injection cannot exfiltrate the token. `SameSite=Lax` mitigates Cross-Site Request Forgery (CSRF) for cross-site POST requests.

---

## ADR-002: Integer Representation (Paise) vs. Floating-Point Decimals

- **Context:** Financial applications must store and compute balances and transfer amounts without precision anomalies.
- **Decision:** Store all currency amounts as positive integers representing the smallest currency denomination (minor units: paise for INR, cents for USD). ₹1.00 = 100 paise.
- **Alternative:** Using IEEE 754 floating-point numbers (`float` or `REAL` in SQL) or decimal strings.
- **Reason:** Binary floating-point cannot accurately represent decimal fractions like 0.1 or 0.2 (e.g. `0.1 + 0.2 = 0.30000000000000004` in JavaScript and Python). Over millions of ledger entries, rounding errors accumulate into unaccountable discrepancies. Integers avoid floating-point errors entirely and make database operations deterministic and fast.

---

## ADR-003: Stored Wallet Balance vs. Ledger-Derived Balance

- **Context:** A user's wallet balance can either be stored as a cached column in the `wallets` table or calculated dynamically on every request by summing the append-only `ledger_entries` (`SUM(credit) - SUM(debit)`).
- **Decision:** We use a **hybrid pattern**: the `wallets` table maintains a `balance_paise` column that is updated in the exact same database transaction that appends the `ledger_entries` row. The ledger entry also records `balance_after_paise` for auditing.
- **Alternative:** Fully derived balance computed on every read (`SELECT SUM(amount) FROM ledger_entries WHERE wallet_id = ?`).
- **Reason:** As transaction history grows to thousands or millions of entries, calculating balance via full-table scans becomes unacceptably slow ($O(N)$ query time). Maintaining an indexed balance column provides $O(1)$ read performance. The append-only ledger acts as the authoritative audit trail, allowing automated reconciliation jobs to detect and alert on any drift.

---

## ADR-004: Concurrency Strategy (Explicitly Documented Limitation in v1)

- **Context:** High-throughput wallet apps face race conditions when two transfers from the same account occur simultaneously.
- **Decision:** In this version 1 learning simulation, concurrency mitigations (such as pessimistic row-locking `SELECT FOR UPDATE` or optimistic version columns) are **deliberately documented as a known limitation** rather than half-implemented, per design specification.
- **Alternative:** Implementing complex distributed locks, optimistic retry loops, or database row locking.
- **Reason:** Highlighting this limitation allows students to clearly explain race conditions, lost updates, and double-spending timelines in interviews, and provide a crisp answer to "What is the biggest weakness in your system and how would you fix it in v2?". Complete remediation pseudo-code is provided in `docs/11-known-limitations-and-concurrency.md`.

---

## ADR-005: Idempotency Key Design

- **Context:** Network timeouts or rapid user double-clicks can cause clients to resend transfer requests, risking duplicate deductions.
- **Decision:** Every transfer attempt can provide an `Idempotency-Key` header (UUIDv4). The backend checks the `idempotency_keys` table. It stores the key, user ID, SHA-256 hash of the request body, HTTP response code, and response body. If the same key arrives with the same payload, the stored response is returned immediately. If the same key arrives with a mismatched payload, HTTP 422 Unprocessable Entity is returned.
- **Alternative:** Relying on frontend button disabling alone, or ignoring idempotency.
- **Reason:** Frontend button disabling fails on network drops, browser refresh, or automated API consumers. Server-side idempotency guarantees that retry attempts cannot move money twice.

---

## ADR-006: Password Hashing with Argon2

- **Context:** User passwords must be protected against brute-force attacks and database credential dumps.
- **Decision:** Use `argon2-cffi` (Argon2id algorithm).
- **Alternative:** bcrypt, PBKDF2, or SHA-256.
- **Reason:** Argon2 is the winner of the Password Hashing Competition (PHC) and is recommended by OWASP. It provides superior resistance against GPU and ASIC cracking attacks by configuring memory cost, time cost, and parallelism.
