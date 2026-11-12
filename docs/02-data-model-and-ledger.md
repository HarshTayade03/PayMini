# Data Model, Ledger & Money Architecture

---

## 1. ASCII Entity-Relationship (ER) Diagram

```text
       +---------------------------------------------+
       |                    users                    |
       +---------------------------------------------+
       | id: VARCHAR(36) [PK, UUID]                  |
       | email: VARCHAR(255) [UNIQUE, INDEX]         |
       | hashed_password: VARCHAR(255)               |
       | created_at: TIMESTAMPTZ                     |
       +---------------------------------------------+
                              | 1
                              |
                              | 1 (has one)
                              v
       +---------------------------------------------+
       |                   wallets                   |
       +---------------------------------------------+
       | id: VARCHAR(36) [PK, UUID]                  |
       | user_id: VARCHAR(36) [FK -> users.id, UQ]   |
       | balance_paise: BIGINT [DEFAULT 0]           |
       | currency: VARCHAR(3) [DEFAULT 'INR']        |
       | created_at: TIMESTAMPTZ                     |
       | updated_at: TIMESTAMPTZ                     |
       +---------------------------------------------+
               | 1                          | 1
               | (sender)                   | (recipient)
               v                            v
       +---------------------------------------------+
       |                  transfers                  |
       +---------------------------------------------+
       | id: VARCHAR(36) [PK, UUID]                  |
       | sender_wallet_id: VARCHAR(36) [FK, INDEX]   |
       | recipient_wallet_id: VARCHAR(36) [FK, INDEX]|
       | amount_paise: BIGINT                        |
       | currency: VARCHAR(3)                        |
       | note: VARCHAR(255) [NULLABLE]               |
       | status: VARCHAR(20) [COMPLETED / FAILED]    |
       | created_at: TIMESTAMPTZ [INDEX]             |
       +---------------------------------------------+
               | 1
               |
               | N (has 2 ledger entries per transfer)
               v
       +---------------------------------------------+
       |               ledger_entries                |
       +---------------------------------------------+
       | id: VARCHAR(36) [PK, UUID]                  |
       | wallet_id: VARCHAR(36) [FK -> wallets.id]   |
       | transfer_id: VARCHAR(36) [FK -> transfers.id|
       | entry_type: VARCHAR(10) [CREDIT / DEBIT]    |
       | amount_paise: BIGINT                        |
       | balance_after_paise: BIGINT                 |
       | description: VARCHAR(255)                   |
       | created_at: TIMESTAMPTZ [INDEX]             |
       +---------------------------------------------+
       * Composite Index: (wallet_id, created_at)

       +---------------------------------------------+
       |              idempotency_keys               |
       +---------------------------------------------+
       | id: VARCHAR(36) [PK, UUID]                  |
       | key: VARCHAR(255) [INDEX]                   |
       | user_id: VARCHAR(36) [FK -> users.id, INDEX]|
       | request_hash: VARCHAR(64) [SHA-256]         |
       | response_code: INTEGER                      |
       | response_body: TEXT                         |
       | created_at: TIMESTAMPTZ                     |
       +---------------------------------------------+
       * Unique Constraint: (key, user_id)
```

---

## 2. Integer Money Representation: Why Floats Fail

A non-negotiable rule in financial software engineering is: **Money is never stored or computed as a floating-point number.**

### The IEEE 754 Binary Floating-Point Problem
Computers represent numbers in base-2 (binary). Just as $\frac{1}{3}$ cannot be written as a finite decimal in base-10 ($0.33333...$), fractions like $0.1$ or $0.2$ cannot be represented as finite fractions in binary:

In Python:
```python
>>> 0.1 + 0.2
0.30000000000000004
>>> 0.1 + 0.2 == 0.3
False
```

In JavaScript:
```javascript
> 0.1 + 0.2
0.30000000000000004
```

### Accumulation of Errors in a Ledger
Imagine calculating balances by summing millions of floating-point transactions. Tiny errors in the 17th decimal place gradually creep into the integer paise and rupee units, resulting in balance discrepancies that fail regulatory financial audits.

### The Minor Unit Solution (Paise)
PayMini represents all currency as **positive 64-bit integers (`BIGINT`)** denominated in the currency's smallest non-divisible minor unit:
- In India: 1 Rupee = 100 Paise.
- ₹1.00 is stored as integer `100`.
- ₹500.00 is stored as integer `50000`.
- ₹0.05 is stored as integer `5`.

Integer arithmetic is exact, deterministic across all operating systems, and natively supported by CPU hardware without precision degradation:
```python
# Exact, deterministic calculation:
balance_paise = 50000
debit_paise = 15025
new_balance = balance_paise - debit_paise # Exactly 34975 (₹349.75)
```

Formatting to human-readable strings happens in exactly **one** centralized place in the backend ([money.py](file:///d:/wallet-proj/backend/app/core/money.py)) and **one** place in the frontend ([format.ts](file:///d:/wallet-proj/frontend/lib/format.ts)).

---

## 3. Double-Entry Accounting & The Append-Only Ledger

In traditional bookkeeping, money is never created or destroyed out of nowhere; it moves from one account to another.

### Ledger Immutability
The `ledger_entries` table in PayMini is strictly **append-only**.
- No `UPDATE` SQL statement is ever executed on `ledger_entries`.
- No `DELETE` SQL statement is ever executed on `ledger_entries`.

If an error or refund occurs, you do not modify the past row; you append a compensating row. This guarantees an incontrovertible audit trail for internal compliance and external regulators.

### Double-Entry Invariant
For every peer-to-peer transfer of amount $X$:
1. A `DEBIT` entry of amount $X$ is written to the sender's wallet ledger.
2. A `CREDIT` entry of amount $X$ is written to the recipient's wallet ledger.
3. $\sum \text{Debits} = \sum \text{Credits} = X$.

The net change across the entire system for any transfer is zero:
$$(-X) + (+X) = 0$$

---

## 4. Stored Balance vs. Ledger-Derived Balance Trade-Off

| Approach | Read Latency | Write Complexity | Auditability | Risk of Drift |
| :--- | :--- | :--- | :--- | :--- |
| **Purely Derived Balance** (`SELECT SUM(...)`) | $O(N)$ with history size (Slow) | Low (Write only to ledger) | Excellent | Zero drift |
| **Purely Stored Balance** (No ledger) | $O(1)$ constant time (Fast) | Low | Terrible (No history) | High |
| **Hybrid Model (PayMini)** | **$O(1)$ constant time (Fast)** | **Medium (Both in 1 TX)** | **Excellent** | **Detectible by reconciliation** |

### Why We Selected the Hybrid Pattern
A user checks their balance dozens of times a day. If a user has 50,000 lifetime transactions, computing `SUM(amount)` across 50,000 rows on every home page visit causes heavy database I/O, cache invalidation, and slow response times.

By maintaining `balance_paise` in `wallets` and updating it in the exact same ACID transaction that writes the `ledger_entries`, we obtain:
1. Instantaneous $O(1)$ balance reads.
2. Complete transaction history.
3. A continuous audit trail via `balance_after_paise` on each ledger entry.

A nightly reconciliation background script can easily run `SELECT SUM(...)` and verify that the stored column matches the sum of historical ledger rows.

---

## 5. Indexing & Query Performance (EXPLAIN Plan)

When users view their transaction history, they query:
```sql
SELECT * FROM ledger_entries
WHERE wallet_id = 'wallet_uuid_here'
ORDER BY created_at DESC, id DESC
LIMIT 10;
```

Without an index, the database would have to perform a **Sequential Scan (`Seq Scan`)** over the entire table, examining every transaction across all users and sorting them in memory.

### Composite Index
We defined a composite B-tree index in SQLAlchemy:
```python
Index("idx_ledger_wallet_created", "wallet_id", "created_at")
```

### PostgreSQL EXPLAIN Comparison
Without index:
```text
Seq Scan on ledger_entries  (cost=0.00..18450.00 rows=10 width=128)
  Filter: (wallet_id = 'c4b8...')
  ->  Sort  (cost=18450.00..18451.00 rows=10 width=128)
        Sort Key: created_at DESC
```

With `idx_ledger_wallet_created`:
```text
Index Scan Backward using idx_ledger_wallet_created on ledger_entries  (cost=0.42..8.45 rows=10 width=128)
  Index Cond: (wallet_id = 'c4b8...')
```
The database traverses the B-Tree directly to the user's latest transactions in sub-millisecond time ($O(\log N)$ instead of $O(N)$).

---

## 6. Self-Check Questions

1. *Why is `0.1 + 0.2 != 0.3` in standard programming languages?*
   - **Answer:** IEEE 754 binary floating-point cannot accurately represent numbers that are not sums of powers of two, leading to fractional binary rounding discrepancies.
2. *What is the double-entry accounting invariant for a transfer?*
   - **Answer:** The total debits must exactly equal total credits within the same atomic transaction ($\sum \text{Debits} - \sum \text{Credits} = 0$).
3. *Why do we store `balance_after_paise` on every ledger entry row?*
   - **Answer:** It provides an immutable snapshot of what the wallet balance was immediately following that transaction, allowing auditors to verify the chronological timeline without re-summing from time zero.

---

> [!TIP]
> **Go Deeper (Optional):**
> High-volume ledger databases (like TigerBeetle or central bank core banking systems) use specialized state machines where accounts and transfers are stored directly in contiguous memory-mapped ring buffers, executing up to 1,000,000 transfers per second.
