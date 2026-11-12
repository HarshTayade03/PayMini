# 11 — Known Limitations and Concurrency Architecture

> [!IMPORTANT]
> **Scope & Design Decision:**
> By deliberate design for version 1, Paymini **does NOT implement** row-level locking (`SELECT ... FOR UPDATE`), optimistic version locking, or distributed transaction retries in its application code.
> 
> This document explains the exact race condition that arises under concurrent requests, presents a step-by-step failure timeline, demonstrates the mathematical risk of negative balances / lost updates, and provides illustrative pseudo-code for how to resolve it in a Version 2 upgrade.

---

## 1. What is a Race Condition in Financial Ledgers?

In an idealized single-threaded world, operations execute strictly one after another:
User checks balance $\rightarrow$ User deducts balance $\rightarrow$ User confirms transfer.

In a modern multi-core production server with multiple worker threads or asynchronous event loops, **two requests can execute at the exact same millisecond**. When two or more concurrent processes read and mutate shared state without synchronization, a **race condition** occurs.

---

## 2. Step-by-Step Failure Timeline (The Double-Spend Race)

Suppose Alice has a wallet balance of **₹1,000 (100,000 paise)**.
Alice simultaneously submits two transfer requests:
- **Request A:** Send ₹800 to Bob.
- **Request B:** Send ₹800 to Charlie.

Both requests hit the FastAPI backend at the exact same time, processed by two separate database connections (Worker 1 and Worker 2) running at PostgreSQL default `READ COMMITTED` isolation:

```
Time   Worker 1 (Transfer A: ₹800 to Bob)       Worker 2 (Transfer B: ₹800 to Charlie)
 |
T1     BEGIN TRANSACTION                         BEGIN TRANSACTION
 |
T2     SELECT balance_paise FROM wallets         SELECT balance_paise FROM wallets
       WHERE user_id = 'alice'                   WHERE user_id = 'alice'
       --> Returns: 100,000 paise (₹1,000)       --> Returns: 100,000 paise (₹1,000)
 |
T3     Check: 100,000 >= 80,000? YES!            Check: 100,000 >= 80,000? YES!
       [Validation PASSES]                       [Validation PASSES]
 |
T4     Calculate: 100,000 - 80,000 = 20,000      Calculate: 100,000 - 80,000 = 20,000
 |
T5     UPDATE wallets                            UPDATE wallets
       SET balance_paise = 20000                 SET balance_paise = 20000
       WHERE user_id = 'alice';                  WHERE user_id = 'alice';
 |
T6     INSERT INTO transfers / ledger...         INSERT INTO transfers / ledger...
 |
T7     COMMIT TRANSACTION                        COMMIT TRANSACTION
 |
 v
```

### The Devastating Result
1. Alice had **₹1,000**.
2. Bob received **₹800**.
3. Charlie received **₹800**.
4. Total money sent out: **₹1,600**.
5. Alice's ending stored balance is **₹200** (or worse, overwritten to ₹200 instead of negative ₹600).
6. **Financial Invariant Broken:** Alice created ₹600 out of thin air.

This is known as a **Lost Update** or **Time-of-Check to Time-of-Use (TOCTOU)** vulnerability.

---

## 3. Why PostgreSQL Transactions Alone Do Not Stop This

A common misconception among junior developers is:
> *"I wrapped both queries in `db.begin()`, so transactions make it thread-safe, right?"*

**NO.**
By default, PostgreSQL operates in `READ COMMITTED` isolation level:
- In `READ COMMITTED`, a query sees data committed *before the query began*.
- At time $T_2$, neither worker has committed anything yet. Both workers read the committed balance of ₹1,000.
- PostgreSQL will gladly allow Worker 2 to overwrite the row at $T_5$ once Worker 1 commits.

---

## 4. How to Fix It: Three Industry Solutions

Below are the three standard architectures used by high-scale payment platforms like PayPal and Stripe.

---

### Solution A: Pessimistic Row Locking (`SELECT ... FOR UPDATE`)
*(Most common in relational banking systems)*

#### How It Works:
When reading the sender's wallet, the database takes an exclusive lock on that specific row. Any other concurrent transaction attempting to read that same row with `FOR UPDATE` is forced to **block and wait** until the first transaction commits or rolls back.

#### Illustrative Pseudo-Code (NOT implemented in V1):
```python
# ILLUSTRATIVE PSEUDO-CODE - NOT IN V1 CODEBASE
with db.begin():
    # 'with_for_update()' emits: SELECT ... FOR UPDATE
    sender_wallet = (
        db.query(Wallet)
        .filter(Wallet.user_id == current_user.id)
        .with_for_update()  # <--- ACQUIRES ROW LOCK HERE
        .first()
    )
    
    # Worker 2 trying to read sender_wallet will SLEEP right here
    # until Worker 1 commits!
    if sender_wallet.balance_paise < amount:
        raise InsufficientFunds()
        
    sender_wallet.balance_paise -= amount
    recipient_wallet.balance_paise += amount
    # Commit releases lock; Worker 2 now wakes up and reads balance = 20,000 paise
```

#### Deadlock Risk and Lock Ordering
If Alice transfers to Bob at the exact same millisecond that Bob transfers to Alice:
- Worker 1 locks Alice's wallet, then requests a lock on Bob's wallet.
- Worker 2 locks Bob's wallet, then requests a lock on Alice's wallet.
- **Deadlock!** Both workers wait on each other forever until Postgres terminates one with `DeadlockDetected`.
- *Fix:* Always acquire locks in deterministic alphabetical order by `wallet_id`:
  ```python
  first_id, second_id = sorted([sender.id, recipient.id])
  lock(first_id)
  lock(second_id)
  ```

---

### Solution B: Atomic Conditional UPDATE
*(Fastest, lock-free approach)*

#### How It Works:
Instead of reading the balance into Python memory, validating in Python, and updating, we push the balance check directly into the SQL `UPDATE` statement:

#### Illustrative Pseudo-Code (NOT implemented in V1):
```python
# ILLUSTRATIVE PSEUDO-CODE - NOT IN V1 CODEBASE
rows_updated = db.execute(
    update(Wallet)
    .where(
        Wallet.id == sender_wallet.id,
        Wallet.balance_paise >= amount_paise  # Atomic condition!
    )
    .values(balance_paise=Wallet.balance_paise - amount_paise)
).rowcount

if rows_updated == 0:
    # Either wallet doesn't exist, or balance was insufficient
    raise HTTPException(status_code=400, detail="Insufficient funds")
```
PostgreSQL row-level write locks ensure that concurrent updates queue up sequentially. The second update finds `balance_paise >= 80000` to be `FALSE`, returns 0 rows updated, and fails safely.

---

### Solution C: Optimistic Concurrency Control (OCC with Versioning)

#### How It Works:
Add an integer `version` column to the `wallets` table.
1. Read wallet: `SELECT balance, version FROM wallets WHERE id = 1` $\rightarrow$ `(1000, 4)`.
2. Update:
   ```sql
   UPDATE wallets 
   SET balance = 200, version = 5 
   WHERE id = 1 AND version = 4;
   ```
3. If another worker updated the version to 5 in the interim, the `WHERE version = 4` matches zero rows. The application detects the collision and executes a retry loop.

---

## 5. How to Test for Concurrency Bugs (For V2)

To rigorously verify race condition fixes in Version 2, engineers use parallel load tools:
1. **Locust or k6:** Spin up 50 virtual users simultaneously posting transfers from a single wallet with ₹100 to exhaust funds.
2. **Pytest with `concurrent.futures.ThreadPoolExecutor`:**
   ```python
   # Example future test
   with ThreadPoolExecutor(max_workers=10) as executor:
       futures = [executor.submit(client.post, "/transfers", json=payload) for _ in range(10)]
       responses = [f.result() for f in futures]
   ```
3. **Assertion:** The sender balance must never be negative, and the sum of successful debits must exactly equal initial balance.

---

## 6. Interview Soundbite: "What is the biggest weakness of Paymini?"

When an interviewer asks you this classic question, here is the exact, mature answer to deliver:

> *"The biggest known architectural limitation of Paymini v1 is that balance checks and deductions rely on default `READ COMMITTED` isolation without row locking. If a user triggers two transfers at the exact same millisecond from separate connections, both could pass the balance check before either commits, causing an overdraft or lost update.*
> 
> *In version 1, I prioritized keeping the codebase clean, understandable, and strictly focused on double-entry ledger fundamentals and idempotency.*
> 
> *For Version 2, the fix is straightforward: we would use pessimistic row locking via SQLAlchemy's `.with_for_update()` on the sender's wallet, or an atomic conditional `UPDATE ... WHERE balance_paise >= amount`. To prevent deadlocks when bidirectional transfers occur simultaneously, we would enforce deterministic lock acquisition ordering by sorting wallet IDs."*

This demonstrates humility, deep technical mastery of databases, and a clear vision for production scalability.
