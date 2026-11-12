# 15 — Reading List: Authoritative Engineering Documentation

To deepen your understanding and speak with authority in software engineering interviews, study the official primary documentation rather than secondary blog posts. Below are the curated authoritative sources:

---

## 1. Web Security & Identity Standards

- **OWASP Top 10 Security Risks:**
  [https://owasp.org/www-project-top-ten/](https://owasp.org/www-project-top-ten/)
  *Core reading:* Broken Access Control (IDOR), Cryptographic Failures, and Injection.
- **OWASP Password Storage Cheat Sheet:**
  [https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
  *Core reading:* Why Argon2id and bcrypt are recommended over legacy hash functions.
- **RFC 7519: JSON Web Token (JWT):**
  [https://datatracker.ietf.org/doc/html/rfc7519](https://datatracker.ietf.org/doc/html/rfc7519)
  *Core reading:* Section 4 (JWT Claims) and Section 7 (Signature Validation).
- **MDN Web Docs: HTTP Cookies and Security Flags:**
  [https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
  *Core reading:* `HttpOnly`, `Secure`, and `SameSite` attribute behaviors.

---

## 2. Databases & Concurrency

- **PostgreSQL 16 Documentation: Transaction Isolation:**
  [https://www.postgresql.org/docs/current/transaction-iso.html](https://www.postgresql.org/docs/current/transaction-iso.html)
  *Core reading:* Read Committed vs. Repeatable Read vs. Serializable, and Row-Level Locks (`FOR UPDATE`).
- **PostgreSQL 16 Documentation: Explicit Locking:**
  [https://www.postgresql.org/docs/current/explicit-locking.html](https://www.postgresql.org/docs/current/explicit-locking.html)
  *Core reading:* Table-level and row-level lock interactions.
- **Use The Index, Luke! (SQL Indexing Guide by Markus Winand):**
  [https://use-the-index-luke.com/](https://use-the-index-luke.com/)
  *Core reading:* B-tree indexing mechanics, composite indexes, and understanding `EXPLAIN ANALYZE`.

---

## 3. Financial API Design & Idempotency

- **Stripe Engineering: Designing Robust and Idempotent APIs:**
  [https://stripe.com/blog/idempotency](https://stripe.com/blog/idempotency)
  *Core reading:* Why network retries require idempotent request headers and atomic transaction key commits.
- **IETF Draft: The Idempotency-Key HTTP Header Field:**
  [https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
  *Core reading:* Standardizing client mutation deduplication across HTTP APIs.

---

## 4. Frameworks & Tooling

- **FastAPI Documentation (Dependencies & Security):**
  [https://fastapi.tiangolo.com/tutorial/security/](https://fastapi.tiangolo.com/tutorial/security/)
  *Core reading:* Dependency injection with `Depends()`, OAuth2 with Password and Bearer tokens.
- **SQLAlchemy 2.0 Unified Tutorial:**
  [https://docs.sqlalchemy.org/en/20/tutorial/](https://docs.sqlalchemy.org/en/20/tutorial/)
  *Core reading:* Session management, ORM unit of work, and atomic transaction boundaries.
- **Next.js 14 Documentation: Route Handlers and Server Actions:**
  [https://nextjs.org/docs/app/building-your-application/routing/route-handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
  *Core reading:* Handling requests on the server, manipulating cookies via `next/headers`.
