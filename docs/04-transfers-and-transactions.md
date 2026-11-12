# 04 — Transfers, Transactions, and ACID Guarantees

This document breaks down the peer-to-peer transfer engine in **Paymini**, explaining database transaction mechanics, ACID properties, failure modes, and double-entry invariants.

---

## 1. What and Why

Moving money between two accounts is the defining feature of any payment platform. In a database, moving money is not a single operation:
1. Deduct funds from the sender's wallet.
2. Add funds to the receiver's wallet.
3. Record an audit log for both parties.

If the server crashes, power is lost, or a network error occurs halfway through this sequence, funds could vanish into thin air or be created out of nothing. To prevent financial corruption, databases provide **ACID** transaction guarantees.

---

## 2. Mapping ACID to Paymini

Let us inspect the transfer implementation in `backend/app/api/v1/endpoints/transfers.py` and see how each letter of ACID applies:

```python
# Context Manager ensures BEGIN on entry, COMMIT on normal exit, ROLLBACK on exception
with db.begin():
    # 1. Validation & Sender Balance Check
    sender_wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if sender_wallet.balance_paise < payload.amount_paise:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # 2. Debit Sender
    sender_wallet.balance_paise -= payload.amount_paise
    
    # 3. Credit Receiver
    recipient_wallet.balance_paise += payload.amount_paise

    # 4. Create Transfer Audit Record
    transfer = Transfer(
        sender_id=current_user.id,
        recipient_id=recipient.id,
        amount_paise=payload.amount_paise,
        currency="INR",
        status="COMPLETED",
        note=payload.note,
    )
    db.add(transfer)
    db.flush()  # Populates transfer.id for foreign key constraints

    # 5. Create Immutable Ledger Entries
    debit_entry = LedgerEntry(
        wallet_id=sender_wallet.id,
        transfer_id=transfer.id,
        entry_type="DEBIT",
        amount_paise=payload.amount_paise,
        balance_after_paise=sender_wallet.balance_paise,
        description=f"Sent to {recipient.email}",
    )
    credit_entry = LedgerEntry(
        wallet_id=recipient_wallet.id,
        transfer_id=transfer.id,
        entry_type="CREDIT",
        amount_paise=payload.amount_paise,
        balance_after_paise=recipient_wallet.balance_paise,
        description=f"Received from {current_user.email}",
    )
    db.add_all([debit_entry, credit_entry])
```

### 1. Atomicity ("All or Nothing")
- **Definition:** Either all operations in the transaction succeed and commit together, or none of them do.
- **In Paymini:** We wrap the entire operation inside `with db.begin():`. If an unhandled exception or database error occurs after updating `sender_wallet` but before writing `credit_entry`, SQLAlchemy issues a `ROLLBACK` command to PostgreSQL. Both wallets revert to their pre-transaction balances. Money is never lost in transit.

### 2. Consistency ("Preserve System Invariants")
- **Definition:** The database moves from one valid state to another, satisfying all schema rules, foreign keys, and check constraints.
- **In Paymini:**
  - Database schema constraints enforce `amount_paise > 0` on ledger entries and transfers.
  - Foreign key constraints ensure `wallet_id` must reference an existing wallet.
  - Invariant: $\Delta \text{Sender Balance} + \Delta \text{Receiver Balance} = -X + X = 0$. The net balance change across the entire system is zero.

### 3. Isolation ("Independent Concurrent Execution")
- **Definition:** Transactions executing concurrently should not interfere with one another.
- **In Paymini (Read Committed):** PostgreSQL default isolation level is `READ COMMITTED`. Other transactions cannot view uncommitted balance deductions or draft ledger rows until `db.commit()` finishes.
- *(Note: Concurrent race condition limitations are deeply discussed in `docs/11-known-limitations-and-concurrency.md`)*.

### 4. Durability ("Surviving Power Loss")
- **Definition:** Once a transaction is committed, its changes survive crashes, server reboots, and storage failures.
- **In Paymini:** PostgreSQL commits changes to its **Write-Ahead Log (WAL)** on disk before acknowledging the commit. If the container or server immediately dies, the database replays the WAL on restart to restore the committed state.

---

## 3. The Double-Entry Ledger Pattern

In traditional consumer banking, an account balance is not merely an editable cell in an Excel sheet. An account balance is the **mathematical sum of an append-only ledger history**.

```
+-----------------------------------------------------------------------------------------+
|                                    TRANSFER #101 (₹50.00)                               |
|                                                                                         |
|        [SENDER: Alice]                                       [RECIPIENT: Bob]           |
|  Initial Balance: 10,000 paise (₹100)                  Initial Balance: 2,000 paise (₹20)|
|                                                                                         |
|       +-------------------+                                 +-------------------+       |
|       |   LEDGER ENTRY    |                                 |   LEDGER ENTRY    |       |
|       | Type: DEBIT       |                                 | Type: CREDIT      |       |
|       | Amount: 5,000     |                                 | Amount: 5,000     |       |
|       | Bal After: 5,000  |                                 | Bal After: 7,000  |       |
|       +-------------------+                                 +-------------------+       |
|                 \                                                     /                 |
|                  +------------------ SUM = 0 ------------------------+                  |
+-----------------------------------------------------------------------------------------+
```

### The Three Invariants
1. **Zero-Sum Ledger:** For every transfer, exactly one `DEBIT` and one `CREDIT` row are created with the identical `amount_paise`.
2. **Reconciliation Invariant:**
   $$\text{Wallet Balance} = \sum(\text{CREDIT amounts}) - \sum(\text{DEBIT amounts})$$
3. **Audit Trail Immutability:** Ledger entries are never updated or deleted. Corrections are made via compensatory entries (e.g., refund entries), never via `DELETE`.

---

## 4. Failure Scenarios and Rollback Mechanics

Let us analyze what happens when things go wrong during transfer execution:

```
Step 1: Check balance (Alice has ₹100, wants to send ₹50) -> OK
Step 2: Decrement Alice's wallet -> 5,000 paise
Step 3: Increment Bob's wallet -> 7,000 paise
Step 4: Network disconnects / Postgres crashes / Out of memory!
```
- **What happens?** The database connection terminates abruptly. PostgreSQL detects the broken TCP socket or cleans up in-flight uncommitted transactions on startup.
- **Result:** Alice's balance remains ₹100. Bob's balance remains ₹20. No partial state is ever persisted.

---

## 5. Self-Check Questions

#### 1. What does the `db.flush()` command do in SQLAlchemy, and why is it used before writing ledger entries?
**Answer:** `db.flush()` sends pending SQL statements to the database without committing the transaction. This generates auto-incrementing primary keys or UUIDs (such as `transfer.id`) so that downstream rows (the `LedgerEntry` foreign key references) can use them within the same atomic transaction.

#### 2. What would happen if we updated Alice's balance in one API request and Bob's balance in a separate API request?
**Answer:** The operation would lose **Atomicity**. If the network drops or the server crashes between the two requests, Alice's money would be deducted without Bob ever receiving it, corrupting the financial state.

#### 3. What is the difference between a `ROLLBACK` and a compensatory transaction (refund)?
**Answer:** A `ROLLBACK` cancels an in-flight, uncommitted transaction before it is permanently saved to the database. A compensatory transaction occurs *after* a transaction has already committed; because the ledger is append-only, you cannot undo history, so you write a new transfer in the opposite direction.

---

## 6. Common Beginner Mistakes

1. **Using multiple transactions for one transfer:**
   - *Mistake:* Committing after deducting sender funds, then opening a new transaction to credit receiver funds.
   - *Fix:* Always perform both sides of a double-entry transfer in a single database transaction.
2. **Catching exceptions and silently committing partial work:**
   - *Mistake:* Putting `try ... except` around parts of the transfer logic without re-raising or issuing a rollback.
3. **Allowing transfers to oneself:**
   - *Mistake:* Not checking if `sender_id == recipient_id`, allowing users to artificially pump their transaction history or trigger race conditions against themselves.
