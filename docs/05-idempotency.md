# 05 — Idempotency and Payment Safety

This document explains the concept of **Idempotency**, why it is critical in financial engineering, and how Paymini implements request deduplication using SHA-256 payload fingerprinting.

---

## 1. What and Why

In network programming, there is a fundamental rule:
> *"The network is unreliable. Requests will drop, timeouts will trigger, and users will double-click buttons."*

### The Double-Debit Problem
Imagine a user sending ₹500 to a friend on a train with spotty mobile 4G connectivity:
1. User clicks "Confirm Send".
2. The browser dispatches `POST /api/v1/transfers`.
3. The server receives the request, deducts ₹500, credits ₹500, and commits to the database.
4. While the server is returning `201 Created`, the cell tower drops the TCP connection.
5. The browser displays: *"Network error: Transfer failed or timed out."*
6. The user clicks "Confirm Send" a second time.

Without idempotency, the server processes the second request as a fresh transfer, **debiting the user ₹500 twice for a total of ₹1,000**.

### Definition of Idempotency
An HTTP operation is **idempotent** if making multiple identical requests has the same intended effect on the server state as making a single request:
$$f(f(x)) = f(x)$$

- `GET`, `PUT`, `DELETE`, and `HEAD` are idempotent by HTTP specification (RFC 7231).
- `POST` is **not** idempotent by default. We must engineer application-level idempotency for financial mutations.

---

## 2. The Paymini Idempotency Flow

Paymini supports the industry-standard `Idempotency-Key` header (modeled after Stripe and PayPal):

```
Client                             Next.js BFF / API                      Database
  |                                       |                                  |
  |--- POST /transfers ------------------>|                                  |
  |    Header: Idempotency-Key: <UUID>    |                                  |
  |    Body: { recipient, amount, note }  |                                  |
  |                                       |--- SELECT * FROM idempotency_keys|
  |                                       |    WHERE key = <UUID> ---------->|
  |                                       |                                  |
  |                                       |<-- NULL (Key not seen before) ---|
  |                                       |                                  |
  |                                       |--- [EXECUTE TRANSFER TX] ------->|
  |                                       |    (Debit, Credit, Ledger)       |
  |                                       |    (INSERT INTO idempotency_keys)|
  |                                       |                                  |
  |<-- 201 Created (Transfer data) -------|                                  |
  |                                       |                                  |
  | === NETWORK DROPS / CLIENT RETRIES == |                                  |
  |                                       |                                  |
  |--- POST /transfers (RETRY) ---------->|                                  |
  |    Header: Idempotency-Key: <UUID>    |                                  |
  |    Body: { recipient, amount, note }  |                                  |
  |                                       |--- SELECT * FROM idempotency_keys|
  |                                       |    WHERE key = <UUID> ---------->|
  |                                       |                                  |
  |                                       |<-- RECORD FOUND -----------------|
  |                                       |    Check: SHA256(Body) matches?  |
  |                                       |    YES -> Replay cached response |
  |                                       |                                  |
  |<-- 201 Created (Cached response) -----| (NO MONEY MOVED A SECOND TIME)   |
```

---

## 3. Implementation Deep-Dive

Let us review the idempotency verification logic in `backend/app/api/v1/endpoints/transfers.py`:

### Step 1: Payload Fingerprinting (SHA-256)
```python
# Hash the request payload to ensure parameters have not been tampered with
request_hash = hashlib.sha256(
    json.dumps(payload.model_dump(), sort_keys=True).encode("utf-8")
).hexdigest()
```
- `sort_keys=True` ensures canonical JSON formatting regardless of key order.
- Hashing compresses any request body into a fixed 64-character hexadecimal digest.

### Step 2: Key Lookup & Conflict Detection
```python
existing_key = db.query(IdempotencyKey).filter(
    IdempotencyKey.key == idempotency_key,
    IdempotencyKey.user_id == current_user.id
).first()

if existing_key:
    # Scenario A: Same key + Different payload -> Client Error
    if existing_key.request_hash != request_hash:
        raise HTTPException(
            status_code=422,
            detail="Idempotency key reused with different request payload"
        )
    # Scenario B: Same key + Same payload -> Replay cached result
    return JSONResponse(
        status_code=existing_key.response_code,
        content=existing_key.response_body
    )
```

### Step 3: Atomic Storage
When a fresh transfer commits, the `IdempotencyKey` record is committed in the **exact same database transaction** as the transfer and ledger rows:
```python
idemp_record = IdempotencyKey(
    key=idempotency_key,
    user_id=current_user.id,
    request_hash=request_hash,
    response_code=201,
    response_body=response_content,
    expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
)
db.add(idemp_record)
db.commit()
```
If the transfer fails, the key is rolled back so the client can fix their balance and retry without changing keys.

---

## 4. Edge Cases and Protections

### 1. Payload Mismatch (Tampering / Key Reuse)
What if a malicious script or buggy frontend generates one UUID and reuses it for sending ₹10 to Bob and then ₹1000 to Charlie?
- The backend detects that `existing_key.request_hash != request_hash`.
- The request is rejected with `422 Unprocessable Entity`.
- No money moves.

### 2. Concurrent In-Flight Requests
What if two identical requests with the same key arrive at the exact same millisecond?
- PostgreSQL enforces a `UNIQUE(key, user_id)` constraint on the `idempotency_keys` table.
- One transaction commits. The other transaction experiences a Unique Violation (`409 Conflict`), rolling back cleanly.

### 3. Expiration & Retention
- **Why keep keys for 24 hours?** Network retries and user retries happen within minutes to hours. Storing idempotency keys forever would bloat the database indefinitely.
- A background worker can run `DELETE FROM idempotency_keys WHERE expires_at < NOW()`.

---

## 5. Self-Check Questions

#### 1. Why must the idempotency record be saved inside the same database transaction as the transfer?
**Answer:** If they were separate, a crash could save the transfer but fail to save the idempotency record. When the client retried, the system wouldn't know the transfer already happened and would execute it a second time.

#### 2. Why do we hash the request body instead of storing the raw JSON string?
**Answer:** Hashing creates a fixed-length (64-byte for SHA-256) canonical representation. It enables fast string equality comparison in index lookups, prevents arbitrary payload storage bloat, and provides privacy protection for sensitive parameters.

#### 3. Why return 422 if the key is reused with a different payload?
**Answer:** Reusing an idempotency key with different parameters indicates a client-side programming error or a man-in-the-middle tampering attempt. Rejecting it with 422 protects against unintended operations.

---

## 6. Common Beginner Mistakes

1. **Client generating a new UUID on every network retry:**
   - *Mistake:* Re-generating `crypto.randomUUID()` inside a `catch` block or retry loop.
   - *Fix:* Generate the idempotency key once when the user initiates the action (e.g., clicking "Send"), and reuse that same key on all automated retries of that action.
2. **Implementing idempotency in-memory:**
   - *Mistake:* Storing keys in a Python dictionary. If the server restarts or scales to multiple instances, retries hit a different instance and double-charge the user. Use the database or a shared Redis cluster.
