# Architecture & System Overview

---

## 1. What the App Does

PayMini is a peer-to-peer (P2P) digital wallet simulation designed to move test funds between registered users in a clean, auditable, and resilient manner.

### Core Capabilities
- **Authentication & Wallet Issuance:** Automatic wallet creation upon registration with a small starter balance of test money (₹500.00 / 50,000 paise).
- **Test Balance Top-Ups:** Safe self-funding of wallets protected by request caps (₹1,000 max per request) and daily cumulative velocity limits (₹5,000 max per day).
- **Atomic Peer-to-Peer Transfers:** Transferring money to another registered user using their email address, executing strictly within a single ACID database transaction.
- **Append-Only Double-Entry Ledger:** Every balance change records immutable debit and credit ledger rows.
- **Idempotency Protection:** Clients transmit unique `Idempotency-Key` headers on transfers, preventing duplicate deductions during network retries or rapid button double-clicks.
- **Cursor-Based Activity Pagination:** Efficient and stable pagination over transaction history with direction filtering.

---

## 2. End-to-End Architecture Diagram

```text
+----------------------------------------------------------------------------------+
|                                CLIENT BROWSER                                    |
|                                                                                  |
|   +--------------------------------------------------------------------------+   |
|   | Next.js Client Components (React 18, Tailwind CSS, Lucide Icons)         |   |
|   | - Test Notice Modal (localStorage acknowledgment)                        |   |
|   | - Send Money Review Dialog                                               |   |
|   | - Tabular Numerals for Monospace Currency Alignment                      |   |
|   +--------------------------------------------------------------------------+   |
+----------------------------------------------------------------------------------+
                                  |
                                  | 1. HTTP Request (Sends httpOnly 'paymini_jwt' cookie)
                                  v
+----------------------------------------------------------------------------------+
|                   NEXT.JS APP ROUTER SERVER (Port 3000)                          |
|                                                                                  |
|   [ Server Route Handlers / Backend-For-Frontend (BFF) Proxy ]                   |
|   - Reads 'paymini_jwt' from secure, httpOnly, SameSite=Lax cookie               |
|   - JavaScript in the browser NEVER touches or inspects the JWT token string     |
|   - Attaches 'Authorization: Bearer <token>' to internal backend calls           |
+----------------------------------------------------------------------------------+
                                  |
                                  | 2. Internal Microservice Call (HTTP Bearer JWT)
                                  v
+----------------------------------------------------------------------------------+
|                     FASTAPI APPLICATION SERVER (Port 8000)                       |
|                                                                                  |
|   [ Security & Middleware Layer ]                                                |
|   - Security Headers (nosniff, DENY frame options, XSS-Protection)               |
|   - Sliding-Window In-Memory Login Rate Limiter (Brute-force protection)         |
|   - Strict CORS policy (Whitelisted frontend origin only)                        |
|                                                                                  |
|   [ Business Logic & Verification ]                                              |
|   - Pydantic v2 Strict Input Validation & Uniform Error Response Formatting      |
|   - Idempotency Handler (SHA-256 payload hashing + cached response replay)       |
|   - IDOR-Protected Ownership Checks (Dependencies inject authenticated wallet)   |
|   - Integer Money Conversion (Centralized formatters for paise minor units)      |
+----------------------------------------------------------------------------------+
                                  |
                                  | 3. Parameterized SQL inside Atomic DB Transactions
                                  v
+----------------------------------------------------------------------------------+
|                     POSTGRESQL 16 DATABASE (Port 5432)                           |
|                                                                                  |
|   - users: Hashed credentials (Argon2id) & account identities                    |
|   - wallets: User-owned balances (indexed for O(1) reads)                        |
|   - transfers: High-level transfer metadata & payment states                     |
|   - ledger_entries: Append-only immutable double-entry ledger                    |
|   - idempotency_keys: Keys, payload hashes, and cached response bodies           |
+----------------------------------------------------------------------------------+
```

---

## 3. Detailed Request Flow: "Sending Money" Step-by-Step

Let us trace what happens when User A transfers ₹150.00 to User B:

1. **User Interaction:**
   - User A types `user_b@example.com`, `150.00`, and an optional note `"Dinner"`.
   - User A clicks **Continue to Review**. The client displays a modal showing the exact recipient and amount.
2. **Review & Confirm:**
   - User A clicks **Confirm & Send**.
   - The button enters a disabled state immediately to prevent browser-level double submissions.
   - The browser generates a cryptographically random UUIDv4 string for the `Idempotency-Key` header.
3. **BFF Proxying:**
   - The browser calls `POST /api/proxy/transfers` with the JSON payload and the `Idempotency-Key` header.
   - The browser automatically attaches the `httpOnly` cookie `paymini_jwt`.
   - Next.js reads the cookie, extracts the token, and makes an internal request to FastAPI: `POST http://backend:8000/api/v1/transfers` with `Authorization: Bearer <token>`.
4. **Backend Processing:**
   - **Authentication:** FastAPI's `get_current_user` dependency decodes and cryptographically verifies the JWT, retrieving User A's database record.
   - **Wallet Lookup (IDOR-safe):** `get_user_wallet` queries the database for the wallet matching `user_id == current_user.id`.
   - **Idempotency Verification:** The backend hashes the request payload with SHA-256 and queries `idempotency_keys`. If an existing entry matches the key and hash, the cached response is replayed immediately without moving funds.
   - **Domain Validations:** Server checks that User A is not transferring money to their own email, that amount is positive, that the amount does not exceed the ₹2,000 transaction cap, and that User A has at least 15,000 paise in their wallet.
   - **Recipient Lookup:** Server finds User B and User B's wallet.
5. **Atomic Database Transaction:**
   - FastAPI opens a single database transaction:
     1. Creates a `transfers` row.
     2. Deducts 15,000 paise from User A's wallet row.
     3. Appends a `DEBIT` entry to `ledger_entries` recording User A's new balance.
     4. Adds 15,000 paise to User B's wallet row.
     5. Appends a `CREDIT` entry to `ledger_entries` recording User B's new balance.
     6. Persists the `IdempotencyKey` record containing the key, payload hash, and HTTP 201 response.
     7. Executes `db.commit()`.
6. **Response & Receipt:**
   - The backend responds with HTTP 201 Created and the transfer receipt payload.
   - The Next.js frontend transitions to Step 3 (Success Receipt), rendering the reference ID and updated balances.

---

## 4. Codebase Directory Tour

```text
wallet-proj/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated CI running backend pytest & frontend build
├── backend/
│   ├── alembic/                   # Database migration environment and revision files
│   ├── app/
│   │   ├── api/v1/endpoints/      # Route controllers: auth, wallet, transfers, transactions, health
│   │   ├── core/                  # Config, database engine, security (Argon2/JWT), rate limiter, money
│   │   ├── models/                # SQLAlchemy 2.0 declarative database models
│   │   ├── schemas/               # Pydantic v2 schemas for request validation & response formatting
│   │   └── main.py                # FastAPI entrypoint, CORS, security headers, exception handlers
│   ├── tests/                     # Automated pytest test suites (auth, wallet, transfers, IDOR)
│   ├── Dockerfile                 # Non-root container image for Python backend
│   └── requirements.txt           # Pinned Python package dependencies
├── frontend/
│   ├── app/                       # Next.js 14 App Router pages, layouts, error boundaries, API routes
│   │   ├── api/                   # BFF route handlers (auth login/register/logout and backend proxy)
│   │   ├── (screens)/             # Home (/), Send (/send), Activity (/activity), Top-up (/top-up)
│   ├── components/                # Reusable UI widgets: Navbar, Footer, TestNoticeModal
│   ├── lib/                       # Types, centralized money formatters, server-side auth helpers
│   ├── Dockerfile                 # Standalone production runner container for Next.js
│   └── package.json               # Frontend dependencies (React, Next.js, Tailwind, Lucide)
├── docs/                          # Comprehensive technical and interview documentation
├── docker-compose.yml             # Orchestration for local development (FastAPI + Next.js + Postgres)
├── .env.example                   # Annotated template of environment variables
└── README.md                      # Quickstart guide, architecture summary, and project index
```

---

## 5. Key Decisions & Alternatives

| Choice | Alternative Considered | Why We Chose It |
| :--- | :--- | :--- |
| **Next.js BFF + httpOnly Cookies** | Direct browser-to-FastAPI calls with tokens in `localStorage` | Completely eliminates token theft via client-side Cross-Site Scripting (XSS). |
| **Integer Minor Units (Paise)** | Python `float` or SQL `numeric(10,2)` | Banish IEEE 754 floating-point inaccuracies and cumulative rounding drift. |
| **Hybrid Stored Balance** | Deriving balance on every read via `SUM(ledger)` | $O(1)$ read performance while retaining the append-only ledger as the audit source of truth. |

---

## 6. What Can Go Wrong & Beginner Pitfalls

1. **Leaking Internal URLs to Browser:** Beginners often write `fetch("http://backend:8000/api/v1/...")` inside client React components. The browser cannot resolve internal Docker hostnames like `http://backend:8000`. The browser must talk to Next.js route handlers, which forward to `backend:8000` inside the container network.
2. **Missing Transaction Boundaries:** Splitting balance deductions and ledger appends into separate database commits. If the app crashes halfway through, money vanishes or duplicates without audit entries. Both operations must share one transaction.

---

## 7. Self-Check Questions

1. *Why does the Next.js server sit between the browser and the FastAPI backend?*
   - **Answer:** It acts as a Backend-For-Frontend (BFF), holding the session JWT in an `httpOnly` cookie that browser JavaScript cannot inspect or steal, drastically mitigating XSS impact.
2. *What is the difference between an API route handler in Next.js and a backend controller in FastAPI?*
   - **Answer:** Next.js route handlers act as an authenticating gateway/proxy, managing browser cookies and headers. FastAPI implements the financial domain logic, database queries, and ledger invariants.
3. *What happens if the database connection drops during a transfer execution?*
   - **Answer:** The database transaction is rolled back completely (`db.rollback()`), ensuring neither user's balance changes and no orphan ledger rows exist.

---

> [!TIP]
> **Go Deeper (Optional):**
> In microservice architectures, enterprise payments platforms often use the **API Gateway Pattern** (e.g. Kong, Envoy) to terminate public client sessions and mint short-lived mTLS tokens or signed JWTs for internal service meshes.
