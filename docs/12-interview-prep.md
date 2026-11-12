# 12 — Interview Preparation: PayPal-Level Questions & System Design

This document contains interview scripts, technical Q&A across the entire stack, security defense drills, and a comprehensive "Design PayPal Send Money" system design breakdown.

---

## 1. Project Pitches

### The 30-Second Elevator Pitch
> *"Paymini is an educational peer-to-peer digital wallet built to understand the core financial mechanics behind systems like PayPal and Stripe. It implements an append-only double-entry ledger in PostgreSQL, integer-minor-unit currency handling to prevent floating-point drift, request deduplication via SHA-256 idempotency keys, and a Next.js Backend-for-Frontend that isolates JWT access tokens inside httpOnly cookies so client-side JavaScript never touches authentication tokens."*

### The 2-Minute Architecture Walkthrough
> *"When designing Paymini, I focused on three non-negotiables in financial engineering: data integrity, security, and idempotency.*
> 
> *First, for data integrity, money is never stored as a float. All values are integer minor units (paise). Every transfer is an atomic PostgreSQL transaction that writes a debit entry for the sender, a credit entry for the receiver, and an immutable transfer record. Balances reconcile exactly to the sum of the ledger.*
> 
> *Second, for network resilience, we implement client-generated idempotency keys. If a user double-clicks or their mobile connection drops mid-request, the backend verifies the SHA-256 hash of the request body and safely replays the original response without moving funds twice.*
> 
> *Third, on the frontend, instead of the common anti-pattern of storing JWTs in localStorage where they are vulnerable to XSS exfiltration, we implemented a Next.js BFF proxy. The JWT is sealed inside an httpOnly, SameSite=Lax cookie. The Next.js server unpacks the cookie and forwards authorized requests to FastAPI over a private network.*
> 
> *Our version 1 intentionally stops short of row-locking concurrency, which we have thoroughly analyzed and documented as our primary version 2 upgrade."*

---

## 2. Technical Q&A by Layer

### Layer 1: Data Model & Ledger
**Q1: Why did you choose integer minor units over `NUMERIC` or `FLOAT`?**
*Answer:* Floating-point numbers represent values using IEEE 754 binary fractions, which cannot represent numbers like $0.1$ or $0.7$ precisely (e.g. `0.1 + 0.2 = 0.30000000000000004`). In a ledger with millions of entries, fractional pennies accumulate into real financial discrepancies. While PostgreSQL's `NUMERIC` or `DECIMAL` avoids rounding drift, integer arithmetic in application runtimes (Python/Node) is faster, exact, and maps natively to the lowest non-divisible currency unit (paise or cents).

**Q2: What is the benefit of keeping a stored balance if you already have an append-only ledger?**
*Answer:* Performance versus auditability. Calculating balance on every request via `SELECT SUM(amount) FROM ledger_entries WHERE wallet_id = ?` requires scanning an ever-growing index, leading to $O(N)$ query degradation as transaction volume grows. Storing a materialized `balance_paise` column on the `wallets` table provides instant $O(1)$ reads for UI rendering. We maintain the invariant that stored balance must match ledger sum in the same transaction.

---

### Layer 2: Transactions & ACID
**Q3: Walk me through what happens if the server crashes right after decrementing the sender's balance.**
*Answer:* In Paymini, both wallet balance updates, the transfer row, the debit ledger entry, and the credit ledger entry are enclosed in a single database transaction (`with db.begin():`). PostgreSQL writes changes to its Write-Ahead Log (WAL) in memory. If power fails or the process crashes before `COMMIT`, uncommitted changes are discarded. Upon reboot, the database recovery engine rolls back any uncommitted transaction. Neither the debit nor credit persists.

---

### Layer 3: Idempotency
**Q4: How does Paymini detect if a user reuses an idempotency key maliciously or by mistake?**
*Answer:* We compute the SHA-256 hash of the canonicalized JSON request payload (`sort_keys=True`) and store it alongside the idempotency key. If a request arrives with an existing key, we compare the incoming payload's SHA-256 hash with the stored hash. If they match, we return the cached response. If they differ (e.g. the user tried to change the recipient or amount while reusing the key), we reject the request with `422 Unprocessable Entity`.

---

### Layer 4: Authentication & Security
**Q5: Why did you choose Argon2id over bcrypt?**
*Answer:* bcrypt is an excellent algorithm, but it is primarily CPU-bound and has a 72-byte password truncation limit. Modern attackers utilize custom FPGA and ASIC rigs to crack bcrypt with high parallelism. Argon2id, the winner of the Password Hashing Competition (PHC), incorporates memory hardness, meaning computing each hash requires a configurable amount of physical RAM (e.g., 64 MB), which neutralizes GPU and ASIC brute-forcing.

**Q6: What is an IDOR vulnerability, and how did you prevent it?**
*Answer:* Insecure Direct Object Reference occurs when an endpoint accepts a resource identifier (like `wallet_id` or `account_id`) from client input and accesses the database without verifying ownership. In Paymini, wallet and transaction endpoints never accept a wallet ID in the request path or body. The backend extracts `user_id` directly from the verified cryptographic JWT signature and looks up the associated wallet automatically.

---

### Layer 5: Frontend Architecture
**Q7: Why not just call the FastAPI backend directly from React components in the browser?**
*Answer:* Direct client-to-API communication forces you to store authentication credentials (like JWTs) in browser-accessible storage (`localStorage` or in-memory variables). If any third-party script or dependency contains an XSS vulnerability, the token can be stolen. By introducing a Next.js BFF (Backend-For-Frontend), the browser only talks to Next.js route handlers that manage `httpOnly`, `SameSite=Lax` cookies that JavaScript cannot read. The Next.js server proxies the request to FastAPI with the Bearer token.

---

## 3. System Design Breakdown: "Design PayPal Send Money"

During a 45-minute technical interview, you may be asked to design the Send Money feature for a platform with 100 million users. Here is how to structure your answer:

```
[Client]
   |
   v
[API Gateway / Cloudflare] (DDoS, SSL Termination, WAF)
   |
   v
[Auth & Rate Limit Service] (Token Validation, Redis Token Bucket)
   |
   v
[Transfer Service (BFF / Go / FastAPI)]
   |
   +---> [Idempotency Store (Redis / Aurora Postgres)]
   |
   +---> [Risk & Fraud Engine (Async ML Scoring)]
   |
   +---> [Account & Ledger Service]
            |
            v
         [PostgreSQL Sharded Cluster / CockroachDB]
         (Pessimistic Row Locking / Atomic Conditional Update)
            |
            v
         [Kafka Event Bus] ---> [Notification Service (Email/Push)]
                           ---> [Analytics / Data Warehouse]
```

### Key Scaling Pillars to Mention:
1. **Database Sharding:** Shard users and wallets by `user_id`. When Alice transfers to Bob, if their wallets live on different database shards, implement a **Two-Phase Commit (2PC)** or a **Saga Pattern** with compensatory transactions.
2. **Asynchronous Messaging:** Decouple non-critical paths (sending push notifications, fraud scoring, analytics) by publishing a `TransferCompletedEvent` to Apache Kafka or RabbitMQ.
3. **Partitioned Concurrency:** Implement pessimistic locking with lock ordering (`sorted([sender_id, recipient_id])`) to prevent deadlocks under high-frequency merchant transactions.
