def test_register_success(client):
    res = client.post("/api/v1/auth/register", json={
        "email": "user1@example.com",
        "password": "Password123"
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "user1@example.com"


def test_register_duplicate_email(client):
    client.post("/api/v1/auth/register", json={
        "email": "user1@example.com",
        "password": "Password123"
    })
    res = client.post("/api/v1/auth/register", json={
        "email": "user1@example.com",
        "password": "Password123"
    })
    assert res.status_code == 409
    assert res.json()["error"]["error"] == "email_exists"


def test_register_weak_password(client):
    # Missing numbers
    res = client.post("/api/v1/auth/register", json={
        "email": "user2@example.com",
        "password": "passwordonly"
    })
    assert res.status_code == 422


def test_login_success(client):
    client.post("/api/v1/auth/register", json={
        "email": "login@example.com",
        "password": "Password123"
    })
    res = client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "Password123"
    })
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_invalid_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "login@example.com",
        "password": "Password123"
    })
    res = client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "WrongPassword123"
    })
    assert res.status_code == 401
    # Check that error response format is uniform and does not reveal email presence
    assert res.json()["error"]["message"] == "Invalid email or password"


def test_get_me_endpoint(client):
    reg = client.post("/api/v1/auth/register", json={
        "email": "me@example.com",
        "password": "Password123"
    }).json()
    token = reg["access_token"]

    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "me@example.com"
