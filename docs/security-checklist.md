# Pre-Deployment Security Checklist & OWASP Top 10 Mapping

Use this checklist before deploying PayMini to any public staging or production environment.

---

## 1. Pre-Deployment Verification Checklist

- [ ] **Secrets & Configuration:**
  - [ ] No hardcoded passwords, JWT secrets, or DB credentials exist in git history.
  - [ ] `.env` is listed in `.gitignore` and `.env.example` contains only dummy placeholders.
  - [ ] `SECRET_KEY` is a cryptographically strong random string (minimum 32 bytes).
  - [ ] `APP_ENV` is set to `production` (disables interactive docs if desired, disables debug traces).

- [ ] **Transport & Network Security:**
  - [ ] HTTPS enforced across both frontend and backend domains.
  - [ ] `SameSite=Lax` and `Secure=true` enabled on session cookies.
  - [ ] CORS is restricted strictly to the explicit frontend origin (`FRONTEND_ORIGIN`). No wildcard `*` allowed when credentials are transmitted.

- [ ] **Database & Ledger Safety:**
  - [ ] Database credentials use least-privilege principles (no superuser access for the application).
  - [ ] All database queries use SQLAlchemy 2.0 parameterized statements (no manual SQL string formatting).
  - [ ] Alembic migrations run cleanly to `head`.
  - [ ] Append-only invariant on `ledger_entries` is preserved (no `UPDATE` or `DELETE` endpoints).

- [ ] **Authentication & Access Control (IDOR):**
  - [ ] Passwords hashed with Argon2id; passwords never logged or returned in responses.
  - [ ] Generic error messages on login (`Invalid email or password`) to prevent user enumeration.
  - [ ] Every wallet and transaction endpoint inspects the authenticated JWT token subject; users can never view or manipulate another user's balance.

- [ ] **Input Validation & Abuse Mitigation:**
  - [ ] All inputs validated via Pydantic v2 (email formats, positive amounts, character lengths).
  - [ ] Top-up and transfer amounts strictly capped server-side (preventing integer overflow or unrealistic transfers).
  - [ ] In-memory login rate limiter enabled (mitigates rapid brute-force credential stuffing).
  - [ ] Request payload size limits configured on reverse proxy or ASGI server.

- [ ] **Dependency Hygiene:**
  - [ ] `pip-audit` ran against Python dependencies with 0 critical vulnerabilities.
  - [ ] `npm audit` ran against Node.js frontend dependencies.

---

## 2. OWASP Top 10 (2021) Mapping

| OWASP Vulnerability | Relevance to PayMini | How It Is Handled / Mitigated in PayMini |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | **HIGH** | Every wallet, transaction, and transfer endpoint extracts `current_user` from the cryptographically verified JWT. IDOR (Insecure Direct Object Reference) is prevented by querying DB records matching `user_id == current_user.id`. Covered by dedicated automated pytest suites. |
| **A02: Cryptographic Failures** | **HIGH** | Passwords hashed using Argon2id. Plaintext passwords never stored. JWT tokens signed with HMAC-SHA256 using an environment-provided secret. HTTPS required in transit. Cookies marked `Secure` and `httpOnly`. |
| **A03: Injection** | **HIGH** | SQL injection eliminated by SQLAlchemy 2.0 ORM using strictly parameterized query compilation. Client HTML injection prevented by React JSX auto-escaping; no `dangerouslySetInnerHTML` is used anywhere. |
| **A04: Insecure Design** | **HIGH** | Financial domain modeling enforces: (1) Minor unit integers (no float rounding bugs); (2) Double-entry append-only ledger; (3) Idempotency keys to stop duplicate payments; (4) Explicit documentation of concurrency limits. |
| **A05: Security Misconfiguration** | **MEDIUM** | Strict CORS headers. Generic error handlers suppress raw database tracebacks and stack traces from client responses. Security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`) added on HTTP responses. |
| **A06: Vulnerable and Outdated Components** | **MEDIUM** | Modern pinned dependency versions: FastAPI 0.115+, Pydantic 2.10+, SQLAlchemy 2.0+, Next.js 14/15+. Dependencies audited with `pip-audit` and `npm audit`. |
| **A07: Identification and Authentication Failures** | **HIGH** | Login attempts rate-limited per IP/account. Constant-time comparison semantics in password verification. Uniform error messages on auth failures to block user enumeration attacks. |
| **A08: Software and Data Integrity Failures** | **MEDIUM** | GitHub Actions CI validates code on push. Idempotency records verify SHA-256 hash of incoming transfer payload before replaying response. |
| **A09: Security Logging and Monitoring Failures** | **MEDIUM** | Structural application logs record authentication failures, transfer requests, and system anomalies with user IDs and timestamps, excluding secrets or tokens. |
| **A10: Server-Side Request Forgery (SSRF)** | **LOW / N/A** | PayMini does not fetch user-provided URLs, perform webhooks, or accept external media uploads in version 1. |
