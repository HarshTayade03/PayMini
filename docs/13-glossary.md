# 13 — Technical Glossary

This glossary provides concise, unambiguous one-line definitions for all core concepts used throughout the Paymini architecture.

---

### Core Concepts

- **ACID:** A set of four database properties (Atomicity, Consistency, Isolation, Durability) guaranteeing that transactions are processed reliably even during crashes.
- **Argon2id:** A modern, memory-hard cryptographic password hashing algorithm that resists both GPU and ASIC brute-force attacks.
- **Atomicity:** The guarantee that all operations in a database transaction succeed together or are rolled back completely.
- **Backend-For-Frontend (BFF):** A design pattern where a dedicated server-side layer (Next.js route handlers) translates client requests, manages secure cookies, and proxies calls to backend services.
- **bcrypt:** An adaptive password-hashing function based on the Blowfish cipher, widely used as an industry standard.
- **Broken Object-Level Authorization (IDOR):** A security flaw where an application accesses records using untrusted client input without verifying the requester's ownership.
- **Compensatory Transaction:** A new transaction created to reverse or correct the financial impact of a previously committed, immutable transaction (e.g., a refund).
- **Cross-Site Request Forgery (CSRF):** An attack where a malicious website tricks an authenticated user's browser into performing unwanted actions on another site.
- **Cross-Site Scripting (XSS):** A vulnerability where malicious scripts are injected into benign and trusted websites and executed in the victim's browser.
- **Cursor Pagination:** A pagination strategy using a unique sequential pointer (such as an ID or timestamp) to fetch the next set of rows, avoiding offset degradation on large tables.
- **Double-Entry Ledger:** An accounting method where every financial transaction requires matching and equal debit and credit entries, keeping total net change at zero.
- **Durability:** The database guarantee that committed transactions survive power failures, crashes, and server restarts via write-ahead logging.
- **httpOnly Cookie:** A cookie attribute directing the browser engine to block client-side JavaScript access via `document.cookie`, mitigating token theft via XSS.
- **Idempotency:** A property of operations where executing the same request multiple times produces the identical outcome without duplicate side effects.
- **Idempotency Key:** A unique client-generated token (often a UUID) passed in an HTTP header to detect and deduplicate repeated requests.
- **Insecure Direct Object Reference (IDOR):** See *Broken Object-Level Authorization*.
- **Isolation:** The database guarantee defining when and how concurrent transactions see changes made by one another.
- **JSON Web Token (JWT):** A compact, URL-safe means of representing claims between two parties, digitally signed using a cryptographic secret or key pair.
- **Ledger Invariant:** A fundamental financial rule that must remain true at all times (e.g., wallet balance equals total credits minus total debits).
- **Lost Update:** A concurrency flaw where two transactions simultaneously read the same data and overwrite each other's changes, destroying data integrity.
- **Minor Units:** The smallest non-divisible denomination of a currency represented as an integer (e.g., paise in INR or cents in USD) to prevent floating-point rounding errors.
- **Optimistic Concurrency Control (OCC):** A concurrency strategy where records are checked for version collisions at update time rather than locked during reading.
- **Parameterized Query:** A database querying method that separates SQL code structure from user data values, neutralizing SQL injection attacks.
- **Pessimistic Locking:** A concurrency strategy where database rows are exclusively locked (`SELECT ... FOR UPDATE`) during reads to prevent simultaneous modifications.
- **Rate Limiting:** A control mechanism restricting the number of requests a client or IP can send within a specific time window to protect against brute-force attacks.
- **SameSite Cookie:** A cookie attribute controlling whether cookies are sent with cross-site requests, providing defense against CSRF attacks.
- **Time-of-Check to Time-of-Use (TOCTOU):** A race condition where a system condition changes between the moment it is verified and the moment an action is executed.
- **Write-Ahead Log (WAL):** An append-only log on disk where database transactions are recorded before being applied to storage pages, ensuring crash durability.
