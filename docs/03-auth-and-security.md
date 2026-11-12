# 03 — Authentication and Security

This document explains the authentication architecture and core security controls implemented in **Paymini**, why they were chosen, and how they protect the application against real-world web vulnerabilities.

---

## 1. What and Why

Authentication answers the question: *"Who are you?"*
Authorization answers the question: *"Are you permitted to do this specific action?"*

In financial systems, authentication failure leads to account takeovers, while authorization failure (specifically Insecure Direct Object References or IDOR) leads to users viewing or spending money that is not theirs.

### Key Threats in Web Payments
1. **Credential Stuffing & Brute Force:** Automated bots testing leaked password dumps against your login endpoint.
2. **Token Theft via Cross-Site Scripting (XSS):** Malicious JavaScript executing in the browser to extract access tokens from `localStorage` or memory.
3. **Cross-Site Request Forgery (CSRF):** A third-party malicious site tricking an authenticated user's browser into submitting requests to our API.
4. **Broken Object-Level Authorization (IDOR):** User A altering the URL or payload (`wallet_id=2`) to drain User B's funds.
5. **SQL Injection:** Attackers appending raw SQL queries to read or tamper with transaction databases.

---

## 2. Password Hashing: Argon2id vs bcrypt vs MD5/SHA256

### Why Plain Hashes (MD5, SHA-256) are Unusable for Passwords
Standard cryptographic hash functions like SHA-256 or MD5 were designed to be **fast** and calculate data integrity checksums. A modern GPU cluster can compute tens of billions of SHA-256 hashes per second. If an attacker dumps a database containing plain SHA-256 hashes:
- Precomputed lookup tables (**Rainbow Tables**) reverse common passwords instantly.
- Brute-force guessing costs fractions of a cent per password.

### Key-Stretching and Adaptive Hashing Functions
Password hash functions must be **deliberately slow and computationally expensive**. They incorporate:
1. **Cryptographic Salt:** A unique, random string generated per user and prepended/appended to the password before hashing. Salt guarantees that two users with the exact same password (`Password123!`) have completely different hash strings in the database, defeating rainbow tables.
2. **Work Factors:** Configurable CPU, memory, and parallelism costs that can be increased over time as hardware improves.

| Algorithm | Type | GPU/ASIC Resistance | Status | Paymini Choice |
| :--- | :--- | :--- | :--- | :--- |
| **MD5 / SHA-1** | Fast digest | None (Broken) | Deprecated | ❌ Insecure |
| **SHA-256 / SHA-512** | Fast digest | None | Insecure for passwords | ❌ Insecure |
| **PBKDF2** | CPU-hard | Vulnerable to ASIC/GPU | Acceptable (NIST legacy) | ❌ Dated |
| **bcrypt** | CPU-hard (Blowfish) | Moderate (Memory-limited) | Industry Standard | ⚠️ Strong fallback |
| **Argon2id** | Memory + CPU hard | **Maximum** (Resists GPU/FPGA/ASIC) | **Winner of PHC (2015)** | ✅ **Primary Choice** |

### Paymini Implementation
Paymini uses `pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")`:
```python
# backend/app/core/security.py
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```
- **Hashing vs Encryption:** Encryption is two-way (reversible with a key). Hashing is one-way (mathematically irreversible). Passwords must **never** be encrypted; they must always be **hashed**.
- **Timing Attack Resistance:** `pwd_context.verify()` runs in constant time to prevent attackers from determining password length or character matches via response latency.
- **Enumeration Protection:** If a login fails, Paymini responds with `401 Unauthorized: Invalid email or password`. It never discloses whether the email exists.

---

## 3. JWT Access Tokens & Session Management

### Structure of a JSON Web Token (RFC 7519)
A JWT consists of three base64url-encoded parts separated by dots (`.`):
$$\text{Header} . \text{Payload} . \text{Signature}$$

1. **Header:** Algorithm and token type (`{"alg": "HS256", "typ": "JWT"}`).
2. **Payload (Claims):** Subject (`sub` = user UUID), expiration (`exp`), issued-at (`iat`).
3. **Signature:** Calculated using the server secret key:
   $$\text{HMACSHA256}(\text{base64UrlEncode}(\text{header}) + "." + \text{base64UrlEncode}(\text{payload}), \text{SECRET\_KEY})$$

### Paymini Claims
```python
to_encode = {
    "sub": str(user_id),
    "email": email,
    "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
    "iat": datetime.now(timezone.utc)
}
```

---

## 4. Token Storage: httpOnly Cookies vs. localStorage (The BFF Pattern)

A critical architectural decision in Paymini is the **Backend-For-Frontend (BFF)** token isolation pattern.

```
+---------------------------------------------------------------------------------------+
| BROWSER                                                                               |
|   JavaScript Environment (React)       Cookie Jar (Browser Engine)                    |
|   +--------------------------+         +--------------------------------------------+ |
|   | document.cookie -> EMPTY |         | paymini_token = <JWT>                      | |
|   | (Token is UNREADABLE)    |         | HttpOnly; Secure; SameSite=Lax; Path=/     | |
|   +--------------------------+         +--------------------------------------------+ |
+-------------------------------------------------------|-------------------------------+
                                                        |
                            Automatic HTTPS Request     | [Cookie: paymini_token=...]
                                                        v
+---------------------------------------------------------------------------------------+
| NEXT.JS BACKEND-FOR-FRONTEND (BFF) SERVER                                             |
|   app/api/proxy/[...path]/route.ts                                                    |
|   1. Extracts 'paymini_token' cookie from request header.                             |
|   2. Attaches 'Authorization: Bearer <JWT>' header.                                   |
|   3. Forwards request to FastAPI backend over private network.                        |
+-------------------------------------------------------|-------------------------------+
                                                        |
                            Internal Private API Call   | [Authorization: Bearer <JWT>]
                                                        v
+---------------------------------------------------------------------------------------+
| FASTAPI BACKEND (api/v1)                                                              |
|   Verifies JWT signature and extracts user_id.                                        |
+---------------------------------------------------------------------------------------+
```

### Comparative Analysis: Where to Store the JWT?

| Strategy | XSS Risk | CSRF Risk | Implementation Complexity |
| :--- | :--- | :--- | :--- |
| **`localStorage` / `sessionStorage`** | **CRITICAL:** Any third-party NPM package or inline script can call `localStorage.getItem('token')` and exfiltrate it. | None (Browser does not attach it automatically). | Simplest (Junior dev default). |
| **In-Memory JS Variable** | Low (Lost on tab refresh, requires complex refresh token dance). | None. | High. |
| **`httpOnly` Cookie direct to API** | **IMMUNE:** Browser refuses to expose cookie contents to `document.cookie`. | Moderate (Requires SameSite=Lax/Strict and CSRF tokens for mutations). | Moderate (Requires cross-domain cookie coordination). |
| **BFF Proxy + `httpOnly` Cookie** *(Paymini)* | **IMMUNE:** JavaScript cannot touch the token. | **ELIMINATED:** Next.js route handlers sit on same origin; SameSite=Lax protects cookie. | **Clean & Modular.** |

### Why Paymini Chose the BFF Cookie Pattern
If an attacker exploits an npm supply-chain bug or an HTML injection vulnerability in Paymini, **they cannot steal the session token**. The cookie is flagged:
- `HttpOnly`: Client-side scripts cannot access it.
- `Secure`: Cookie is only transmitted over HTTPS (or `localhost`).
- `SameSite=Lax`: Cookie is omitted on cross-site subrequests (e.g. cross-origin `<img>`, `<iframe>`, or third-party `fetch()`), mitigating CSRF.

---

## 5. Authorization & IDOR (Insecure Direct Object Reference)

### The Vulnerability Explained
An IDOR vulnerability occurs when an application exposes a reference to an internal object (such as a database primary key or wallet ID) and fails to verify that the requesting user owns that object.

**Vulnerable Example:**
```python
# DANGEROUS CODE - DO NOT USE
@router.get("/wallets/{wallet_id}/balance")
def get_balance(wallet_id: UUID, current_user: User = Depends(get_current_user)):
    return db.query(Wallet).filter(Wallet.id == wallet_id).first()
```
*Exploit:* An attacker logs in as User A (`user_id=1`), notes their own `wallet_id=10`, and starts calling `/wallets/11/balance`, `/wallets/12/balance` to harvest all account balances.

### Paymini Defense: Context-Derived Ownership
In Paymini, the API **never** accepts a `wallet_id` in path parameters or request bodies:
```python
# backend/app/api/v1/endpoints/wallet.py
@router.get("", response_model=WalletResponse)
def get_wallet(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Wallet is queried strictly by current_user.id extracted from verified JWT
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet
```
For transaction history, queries filter by `LedgerEntry.wallet_id == wallet.id`. A user cannot even query another user's transactions because the filter is pinned to their authenticated wallet.

*Automated Test Verification:*
Test `test_cannot_read_another_users_wallet_balance` in `backend/tests/test_wallet.py` explicitly proves that User B cannot access User A's wallet.

---

## 6. Protection Against SQL Injection

SQL Injection occurs when user input is concatenated directly into SQL queries:
```python
# DANGEROUS:
db.execute(f"SELECT * FROM users WHERE email = '{user_input}'")
```
An attacker entering `' OR '1'='1` bypasses authentication.

### Paymini Defense: Parameterized Queries via SQLAlchemy ORM
SQLAlchemy uses query parameterization:
```python
user = db.query(User).filter(User.email == credentials.email).first()
```
When compiled to PostgreSQL dialect:
```sql
SELECT users.id, users.email, users.hashed_password 
FROM users 
WHERE users.email = $1 
LIMIT 1;
```
The database engine treats `$1` strictly as a literal string value, never as executable SQL instructions, rendering SQL injection mathematically impossible regardless of characters in the email.

---

## 7. Rate Limiting & Denial of Service (DoS)

To prevent credential brute-forcing, Paymini implements an in-memory sliding-window rate limiter on the login endpoint:
```python
# backend/app/core/rate_limiter.py
class InMemoryRateLimiter:
    def __init__(self, requests_limit: int = 5, window_seconds: int = 60):
        self.limit = requests_limit
        self.window = window_seconds
        self.requests: dict[str, list[float]] = {}
```
- If an IP sends more than 5 login attempts within 60 seconds, the API immediately halts execution with `429 Too Many Requests` and a `Retry-After: 60` header.
- **Honest Limitation:** An in-memory dictionary is stateful per container instance. In a multi-replica autoscaling cluster, requests hitting different pods bypass this counter. Production systems back rate limiters with Redis (using Token Bucket or Leaky Bucket algorithms).

---

## 8. Self-Check Questions

#### 1. Why is salting insufficient on its own if you use SHA-256?
**Answer:** Salting prevents precomputed rainbow tables, but SHA-256 remains computationally lightweight. A single modern GPU can compute billions of salted SHA-256 hashes per second, allowing an attacker to brute-force 8-character passwords within hours. Argon2id and bcrypt add configurable memory and CPU cost factors to slow down each hash check to ~100-300ms.

#### 2. What prevents a malicious script in another browser tab from stealing an `httpOnly` cookie?
**Answer:** The browser sandbox strictly enforces the Same-Origin Policy (SOP). Furthermore, `httpOnly` tells the browser engine to block `document.cookie` access from all JavaScript execution contexts. The cookie is only attached to HTTP request headers sent to the originating domain.

#### 3. How does `SameSite=Lax` protect against Cross-Site Request Forgery (CSRF)?
**Answer:** When an attacker crafts a malicious site with a form that submits a `POST` request to `https://paymini.com/api/transfers`, a cookie with `SameSite=Lax` will **not** be included by the browser on cross-origin `POST` submissions. It is only included on top-level safe navigational requests (like clicking a regular `<a>` link).

#### 4. How does Paymini protect against Insecure Direct Object References (IDOR)?
**Answer:** Endpoints never accept an account or wallet ID from the client. Instead, the backend decodes the verified JWT token, retrieves the authenticated user's ID, and looks up the associated wallet directly in the database.

---

## 9. Common Beginner Mistakes

1. **Returning different error messages for unknown email vs wrong password:**
   - *Wrong:* "User not found" vs "Incorrect password".
   - *Fix:* Always return a generic error like "Invalid email or password" to prevent user enumeration.
2. **Storing JWT in `localStorage`:**
   - *Wrong:* Believing that `localStorage` is safe because it's client-side.
   - *Fix:* Any XSS flaw allows arbitrary script execution to read `localStorage` and transmit tokens to an attacker server. Always use `httpOnly` cookies.
3. **Using JWT for session revocation without a blacklist:**
   - *Mistake:* Assuming logging out in the client revokes a JWT. A standard JWT remains valid until its `exp` timestamp expires. If immediate revocation is required, maintain a Redis token blocklist or keep token lifetimes short (e.g., 15 minutes).

---

> [!TIP]
> **Go Deeper: Public-Key Cryptography (RS256 / EdDSA) vs HMAC (HS256)**
> Paymini uses HS256 (symmetric key), where both token issuer and verifier share `SECRET_KEY`. In large microservice architectures, RS256 or Ed25519 (asymmetric) is preferred: the Auth service signs tokens with a private key, and all downstream services verify tokens using a cached public key without having permission to forge new tokens.
