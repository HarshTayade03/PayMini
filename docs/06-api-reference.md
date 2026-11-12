# 06 — API Reference and Error Formats

This document provides complete documentation of all Paymini API endpoints, request/response formats, status codes, and curl examples.

---

## 1. General Principles

### Base URL
- Local direct API: `http://localhost:8000/api/v1`
- Frontend BFF Proxy: `http://localhost:3000/api/proxy` (automatically attaches authentication cookie)

### Standard Headers
| Header | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `Content-Type` | MIME type of request body | For POST | `application/json` |
| `Authorization` | JWT Bearer token | For protected endpoints | `Bearer eyJhbGciOi...` |
| `Idempotency-Key`| Unique request identifier | Optional for mutations | `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`|

---

## 2. Standard Error Format

All error responses across Paymini follow a consistent schema:

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance for this transfer",
    "details": null
  }
}
```

### Standard Status Codes
- `200 OK`: Request succeeded (GET, or non-creation POST).
- `201 Created`: Resource successfully created (User registration, Transfer execution).
- `400 Bad Request`: Business rule violation (e.g. self-transfer, insufficient balance).
- `401 Unauthorized`: Missing, expired, or invalid token, or wrong login credentials.
- `403 Forbidden`: Authenticated user lacks permission to access resource.
- `404 Not Found`: Target resource does not exist.
- `409 Conflict`: Unique constraint violation (e.g., email already registered).
- `422 Unprocessable Entity`: Validation failure or idempotency payload mismatch.
- `429 Too Many Requests`: Rate limit exceeded.

---

## 3. Endpoints

### 3.1 Health Check
Check operational status of the service and database connectivity.

- **Method / Path:** `GET /api/v1/health`
- **Auth:** None

#### Response (`200 OK`):
```json
{
  "status": "healthy",
  "environment": "development"
}
```

---

### 3.2 Authentication

#### Register a New User
Creates user account and initializes a wallet with starting test balance (10,000 paise = ₹100.00).

- **Method / Path:** `POST /api/v1/auth/register`
- **Auth:** None

#### Request Body:
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

#### Response (`201 Created`):
```json
{
  "id": "c138d6d8-c70f-488f-9a4c-a3099903b41d",
  "email": "user@example.com",
  "is_active": true,
  "created_at": "2026-11-12T10:00:00Z"
}
```

#### Curl Example:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"StrongPassword123!"}'
```

---

#### Login
Authenticates credentials and returns a signed JWT access token.

- **Method / Path:** `POST /api/v1/auth/login`
- **Auth:** None (Rate limited: 5 requests / 60 seconds per IP)

#### Request Body:
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

#### Response (`200 OK`):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

---

#### Get Current User Profile
- **Method / Path:** `GET /api/v1/auth/me`
- **Auth:** `Bearer <token>`

#### Response (`200 OK`):
```json
{
  "id": "c138d6d8-c70f-488f-9a4c-a3099903b41d",
  "email": "user@example.com",
  "is_active": true,
  "created_at": "2026-11-12T10:00:00Z"
}
```

---

### 3.3 Wallet & Test Balance

#### Get Wallet Balance
- **Method / Path:** `GET /api/v1/wallet`
- **Auth:** `Bearer <token>`

#### Response (`200 OK`):
```json
{
  "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "user_id": "c138d6d8-c70f-488f-9a4c-a3099903b41d",
  "balance_paise": 10000,
  "balance_formatted": "₹100.00",
  "currency": "INR",
  "updated_at": "2026-11-12T10:00:00Z"
}
```

---

#### Top-Up Test Money
Add simulation funds to wallet (Max ₹10,000 per request, daily cap ₹50,000).

- **Method / Path:** `POST /api/v1/wallet/top-up`
- **Auth:** `Bearer <token>`

#### Request Body:
```json
{
  "amount_paise": 50000
}
```

#### Response (`200 OK`):
```json
{
  "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "user_id": "c138d6d8-c70f-488f-9a4c-a3099903b41d",
  "balance_paise": 60000,
  "balance_formatted": "₹600.00",
  "currency": "INR",
  "updated_at": "2026-11-12T10:05:00Z"
}
```

---

### 3.4 Transfers

#### Send Money
Execute a peer-to-peer transfer to another registered user.

- **Method / Path:** `POST /api/v1/transfers`
- **Auth:** `Bearer <token>`
- **Optional Header:** `Idempotency-Key: <UUID>`

#### Request Body:
```json
{
  "recipient_email": "friend@example.com",
  "amount_paise": 25000,
  "note": "Lunch split"
}
```

#### Response (`201 Created`):
```json
{
  "id": "8fa134d1-8176-46b2-850c-e274640101c1",
  "sender_id": "c138d6d8-c70f-488f-9a4c-a3099903b41d",
  "recipient_id": "e22934a1-0000-4000-8000-000000000002",
  "amount_paise": 25000,
  "amount_formatted": "₹250.00",
  "currency": "INR",
  "status": "COMPLETED",
  "note": "Lunch split",
  "created_at": "2026-11-12T10:10:00Z"
}
```

---

### 3.5 Transactions (Activity History)

#### Get Transaction History
Retrieve authenticated user's ledger entries with cursor pagination.

- **Method / Path:** `GET /api/v1/transactions`
- **Auth:** `Bearer <token>`
- **Query Parameters:**
  - `limit`: Integer (1-100, default 20)
  - `cursor`: UUID of the last seen ledger entry
  - `direction`: Filter by direction (`all`, `sent`, `received`)

#### Response (`200 OK`):
```json
{
  "items": [
    {
      "id": "18f56bd0-a29e-4b47-b86a-cfbe01529ea4",
      "entry_type": "DEBIT",
      "amount_paise": 25000,
      "amount_formatted": "₹250.00",
      "balance_after_paise": 35000,
      "balance_after_formatted": "₹350.00",
      "description": "Sent to friend@example.com",
      "created_at": "2026-11-12T10:10:00Z"
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```
