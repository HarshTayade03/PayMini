import uuid
from app.models.models import LedgerEntry, LedgerEntryType, Wallet


def register_user(client, email):
    res = client.post("/api/v1/auth/register", json={"email": email, "password": "Password123"})
    return res.json()["access_token"]


def test_transfer_success_and_ledger_invariant(client, db_session):
    """
    Tests:
    1. Successful money movement between Sender and Recipient.
    2. Single-transaction double-entry ledger invariant:
       Sum of DEBITs == Sum of CREDITs for the transfer.
       Wallet stored balance equals the sum of ledger entries.
    """
    token_sender = register_user(client, "sender@example.com")
    token_recipient = register_user(client, "recipient@example.com")

    # Both start with ₹500 (50,000 paise)
    res = client.post(
        "/api/v1/transfers",
        headers={"Authorization": f"Bearer {token_sender}"},
        json={
            "recipient_email": "recipient@example.com",
            "amount_paise": 20000,  # ₹200.00
            "note": "Lunch payment"
        }
    )
    assert res.status_code == 201
    transfer_data = res.json()
    transfer_id = transfer_data["id"]
    assert transfer_data["amount_display"] == "200.00"
    assert transfer_data["status"] == "COMPLETED"

    # Verify Sender Wallet Balance
    res_sender_wallet = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {token_sender}"})
    assert res_sender_wallet.json()["balance_paise"] == 30000  # 50,000 - 20,000 = 30,000

    # Verify Recipient Wallet Balance
    res_rec_wallet = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {token_recipient}"})
    assert res_rec_wallet.json()["balance_paise"] == 70000  # 50,000 + 20,000 = 70,000

    # ---------------- LEDGER INVARIANT AUDIT ----------------
    transfer_entries = db_session.query(LedgerEntry).filter(LedgerEntry.transfer_id == transfer_id).all()
    assert len(transfer_entries) == 2

    debits = [e for e in transfer_entries if e.entry_type == LedgerEntryType.DEBIT]
    credits = [e for e in transfer_entries if e.entry_type == LedgerEntryType.CREDIT]
    assert len(debits) == 1
    assert len(credits) == 1

    # Invariant: debits equal credits
    assert debits[0].amount_paise == credits[0].amount_paise == 20000

    # Invariant: wallet stored balance matches ledger sum
    sender_wallet_id = transfer_data["sender_wallet_id"]
    sender_ledger_entries = db_session.query(LedgerEntry).filter(LedgerEntry.wallet_id == sender_wallet_id).all()
    computed_sender_balance = sum(
        e.amount_paise if e.entry_type == LedgerEntryType.CREDIT else -e.amount_paise
        for e in sender_ledger_entries
    )
    assert computed_sender_balance == 30000


def test_transfer_insufficient_funds(client):
    token = register_user(client, "broke@example.com")
    register_user(client, "rich@example.com")

    res = client.post(
        "/api/v1/transfers",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "recipient_email": "rich@example.com",
            "amount_paise": 150000,  # ₹1500.00 (user only has starter ₹500)
            "note": "Big spend"
        }
    )
    assert res.status_code == 400
    assert res.json()["error"]["error"] == "insufficient_funds"


def test_transfer_self_prohibited(client):
    token = register_user(client, "self@example.com")
    res = client.post(
        "/api/v1/transfers",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "recipient_email": "self@example.com",
            "amount_paise": 5000
        }
    )
    assert res.status_code == 400
    assert res.json()["error"]["error"] == "self_transfer"


def test_transfer_idempotency(client):
    """
    Test that sending the same Idempotency-Key twice with identical payload:
    1. Returns HTTP 201 response payload.
    2. Does NOT deduct money a second time.
    3. Sending same key with different payload returns HTTP 422.
    """
    token = register_user(client, "idemp_sender@example.com")
    register_user(client, "idemp_rec@example.com")

    key = str(uuid.uuid4())
    headers = {
        "Authorization": f"Bearer {token}",
        "Idempotency-Key": key
    }
    payload = {
        "recipient_email": "idemp_rec@example.com",
        "amount_paise": 10000,  # ₹100
        "note": "Idempotent test"
    }

    # First attempt: succeeds
    res1 = client.post("/api/v1/transfers", headers=headers, json=payload)
    assert res1.status_code == 201
    transfer1 = res1.json()

    # Check sender balance after first transfer: 50,000 - 10,000 = 40,000
    w1 = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {token}"}).json()
    assert w1["balance_paise"] == 40000

    # Second attempt with same key and same payload: returns identical response
    res2 = client.post("/api/v1/transfers", headers=headers, json=payload)
    assert res2.status_code == 201
    transfer2 = res2.json()
    assert transfer1["id"] == transfer2["id"]

    # Invariant: money was NOT moved again
    w2 = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {token}"}).json()
    assert w2["balance_paise"] == 40000

    # Third attempt with same key but DIFFERENT payload -> 422 Unprocessable Entity
    different_payload = {
        "recipient_email": "idemp_rec@example.com",
        "amount_paise": 15000,
        "note": "Different payload"
    }
    res3 = client.post("/api/v1/transfers", headers=headers, json=different_payload)
    assert res3.status_code == 422
    assert res3.json()["error"]["error"] == "idempotency_conflict"
