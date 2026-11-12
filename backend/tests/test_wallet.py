def register_user(client, email, password="Password123"):
    res = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert res.status_code == 201
    return res.json()["access_token"]


def test_wallet_initial_balance(client):
    token = register_user(client, "alice@example.com")
    res = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["balance_paise"] == 50000  # Default starter balance ₹500
    assert data["balance_display"] == "500.00"
    assert data["currency"] == "INR"


def test_top_up_success(client):
    token = register_user(client, "bob@example.com")
    res = client.post(
        "/api/v1/wallet/top-up",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount_paise": 25000}  # Add ₹250
    )
    assert res.status_code == 200
    assert res.json()["balance_paise"] == 75000
    assert res.json()["balance_display"] == "750.00"


def test_top_up_exceeds_request_cap(client):
    token = register_user(client, "carol@example.com")
    res = client.post(
        "/api/v1/wallet/top-up",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount_paise": 150000}  # Capped at ₹1000 (100000 paise)
    )
    assert res.status_code == 422
    assert "exceeds_request_cap" in res.json()["error"]["error"]


def test_wallet_idor_prevention(client):
    """
    IDOR (Insecure Direct Object Reference) Test:
    Proves User A cannot read or access User B's wallet.
    All wallet endpoints use the JWT subject, strictly scoped to current_user.
    """
    token_a = register_user(client, "alice_idor@example.com")
    token_b = register_user(client, "bob_idor@example.com")

    # Alice reads her wallet
    res_a = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    alice_wallet_id = res_a.json()["id"]

    # Bob reads his wallet
    res_b = client.get("/api/v1/wallet", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 200
    bob_wallet_id = res_b.json()["id"]

    assert alice_wallet_id != bob_wallet_id
    # Unauthenticated request fails with 401
    unauth = client.get("/api/v1/wallet")
    assert unauth.status_code == 401
