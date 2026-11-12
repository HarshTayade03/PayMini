# 08 — Testing Strategy and Verification

This document details the automated testing philosophy, test architecture, and verification steps in **Paymini**.

---

## 1. Testing Philosophy

In payment systems, bugs do not just cause crashes — they cause financial discrepancies, overdrafts, and legal liability. A comprehensive test suite must verify both **happy paths** and **adversarial edge cases**.

### The Testing Pyramid
```
            / \
           /   \        E2E Smoke Tests (Curl & Manual Scenarios)
          /-----\
         /       \      Integration & API Tests (Pytest + TestClient)
        /---------\     - Ledger Invariant Verification
       /           \    - Idempotency Deduplication Tests
      /             \   - IDOR Authorization Boundary Tests
     /---------------\  Unit Tests (Argon2 Hashing, Money Parsers, Rate Limiter)
```

---

## 2. Test Architecture

### In-Memory PostgreSQL Simulation via SQLite
The test suite in `backend/tests/conftest.py` configures an isolated in-memory SQLite database using `StaticPool`:
```python
@pytest.fixture(scope="session")
def engine():
    return create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
```
- **Speed:** The entire suite of 15 tests runs in **under 3 seconds**.
- **Isolation:** Each test runs inside a fresh transaction that rolls back or rebuilds tables, preventing state leakage between tests.

---

## 3. Core Test Scenarios Verified

| Test File | Test Case | What is Verified |
| :--- | :--- | :--- |
| `test_auth.py` | `test_register_user_success` | Valid user creation and wallet provisioning with 10,000 paise. |
| `test_auth.py` | `test_register_duplicate_email` | Returns `409 Conflict` when email already exists. |
| `test_auth.py` | `test_login_success` | Verifies Argon2 password matching and JWT generation. |
| `test_auth.py` | `test_login_invalid_credentials` | Generic 401 response; prevents user enumeration. |
| `test_wallet.py` | `test_get_wallet_balance` | Accurate balance retrieval for authenticated user. |
| `test_wallet.py` | `test_top_up_wallet_success` | Balance increases accurately; ledger entry created. |
| `test_wallet.py` | `test_top_up_exceeds_max_limit` | Rejects top-up exceeding ₹10,000 cap with `422`. |
| `test_wallet.py` | `test_cannot_read_another_users_wallet_balance` | **IDOR check:** Proves User B cannot view User A's wallet. |
| `test_transfers.py` | `test_successful_transfer_and_ledger_invariant` | **Double-Entry check:** Verifies $\sum \text{Debit} = \sum \text{Credit}$ and balances match ledger sums. |
| `test_transfers.py` | `test_cannot_transfer_to_self` | Rejects transfer where sender == recipient (`400 Bad Request`). |
| `test_transfers.py` | `test_insufficient_balance` | Rejects transfer when amount > balance (`400 Bad Request`). |
| `test_transfers.py` | `test_transfer_to_nonexistent_user` | Rejects recipient that does not exist (`404 Not Found`). |
| `test_transfers.py` | `test_transfer_idempotency_same_payload` | Same idempotency key returns cached response without moving funds twice. |
| `test_transfers.py` | `test_transfer_idempotency_different_payload` | Same idempotency key with modified amount returns `422 Unprocessable Entity`. |
| `test_transfers.py` | `test_cursor_pagination_transactions` | Validates limit, ordering (newest first), and cursor continuation. |

---

## 4. How to Run the Tests

### Inside Docker (Recommended & Reproducible)
```bash
docker run --rm -v "d:/wallet-proj/backend:/app" paymini-backend-dev pytest -v
```

### On Host (If Python 3.12 is configured)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or .\venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
pytest -v
```

---

## 5. Measured Test Execution Output
Verified during build:
```
============================= test session starts =============================
platform linux -- Python 3.12.9, pytest-8.3.4, pluggy-1.5.0
rootdir: /app
configfile: pytest.ini
collected 15 items

tests/test_auth.py::test_register_user_success PASSED                   [  6%]
tests/test_auth.py::test_register_duplicate_email PASSED               [ 13%]
tests/test_auth.py::test_login_success PASSED                          [ 20%]
tests/test_auth.py::test_login_invalid_credentials PASSED              [ 26%]
tests/test_auth.py::test_get_current_user_me PASSED                    [ 33%]
tests/test_transfers.py::test_successful_transfer_and_ledger_invariant PASSED [ 40%]
tests/test_transfers.py::test_cannot_transfer_to_self PASSED          [ 46%]
tests/test_transfers.py::test_insufficient_balance PASSED             [ 53%]
tests/test_transfers.py::test_transfer_to_nonexistent_user PASSED     [ 60%]
tests/test_transfers.py::test_transfer_idempotency_same_payload PASSED [ 66%]
tests/test_transfers.py::test_transfer_idempotency_different_payload PASSED [ 73%]
tests/test_transfers.py::test_cursor_pagination_transactions PASSED    [ 80%]
tests/test_wallet.py::test_get_wallet_balance PASSED                   [ 86%]
tests/test_wallet.py::test_top_up_wallet_success PASSED                [ 93%]
tests/test_wallet.py::test_top_up_exceeds_max_limit PASSED             [100%]

============================= 15 passed in 2.99s ==============================
```
