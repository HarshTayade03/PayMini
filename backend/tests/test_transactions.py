def register_user(client, email):
    res = client.post("/api/v1/auth/register", json={"email": email, "password": "Password123"})
    return res.json()["access_token"]


def test_transactions_history_and_pagination(client):
    token_a = register_user(client, "user_a@example.com")
    register_user(client, "user_b@example.com")

    # Perform 3 transfers
    for i in range(3):
        client.post(
            "/api/v1/transfers",
            headers={"Authorization": f"Bearer {token_a}"},
            json={
                "recipient_email": "user_b@example.com",
                "amount_paise": 1000 * (i + 1),
                "note": f"Transfer #{i+1}"
            }
        )

    # 1. Test Fetching with Limit = 2
    res = client.get("/api/v1/transactions?limit=2", headers={"Authorization": f"Bearer {token_a}"})
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 2
    assert data["has_more"] is True
    assert data["next_cursor"] is not None

    # 2. Test Pagination using Cursor
    next_cursor = data["next_cursor"]
    res2 = client.get(f"/api/v1/transactions?limit=2&cursor={next_cursor}", headers={"Authorization": f"Bearer {token_a}"})
    assert res2.status_code == 200
    data2 = res2.json()
    # Starter balance (CREDIT) + remaining transfer
    assert len(data2["items"]) > 0

    # 3. Test Direction Filter (Sent vs Received)
    res_sent = client.get("/api/v1/transactions?direction=sent", headers={"Authorization": f"Bearer {token_a}"})
    assert res_sent.status_code == 200
    sent_items = res_sent.json()["items"]
    assert all(item["entry_type"] == "DEBIT" for item in sent_items)

    res_received = client.get("/api/v1/transactions?direction=received", headers={"Authorization": f"Bearer {token_a}"})
    assert res_received.status_code == 200
    recv_items = res_received.json()["items"]
    assert all(item["entry_type"] == "CREDIT" for item in recv_items)
