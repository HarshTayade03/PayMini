# 10 — Post-Launch: Monitoring, Maintenance, and Security Operations

This document covers operational best practices after deploying Paymini, including smoke testing, log inspection, health monitoring, and security hygiene.

---

## 1. Post-Deployment Smoke Test Checklist

Execute this automated or manual smoke-test sequence immediately following any production deployment:

- [ ] **1. Health Check:**
  `curl -i https://your-backend.onrender.com/api/v1/health`
  *Expected:* `200 OK`, `{"status": "healthy"}`.
- [ ] **2. Register User A:**
  Register `test_a@paymini.dev` with a valid password. Confirm `201 Created` and check that initial balance is ₹100.00.
- [ ] **3. Register User B:**
  Register `test_b@paymini.dev`. Confirm initial balance is ₹100.00.
- [ ] **4. Top-Up Test Money:**
  Add ₹500.00 to User A. Confirm new balance is ₹600.00.
- [ ] **5. Peer-to-Peer Transfer:**
  Send ₹250.00 from User A to User B with note "Smoke test".
  *Verify:*
  - User A balance: ₹350.00
  - User B balance: ₹350.00
- [ ] **6. Idempotency Test:**
  Replay the exact same `curl` command with the identical `Idempotency-Key`.
  *Expected:* `201 Created` with identical response body, and neither balance changes.
- [ ] **7. Activity Ledger Audit:**
  Fetch `/api/v1/transactions` for both users. Verify User A has a `DEBIT` of ₹250.00 and User B has a `CREDIT` of ₹250.00.
- [ ] **8. Security Headers Verification:**
  Verify response headers on `https://your-frontend.vercel.app`:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 2. Structured Logging & Error Tracking

### Why Plain Print Statements are Harmful
Using `print()` outputs unformatted strings without timestamps, request correlation IDs, or stack trace structure. In distributed or serverless systems, finding errors in raw print logs is tedious and error-prone.

### Paymini Structured Logging
Paymini configures Python's `logging` module to output JSON logs in production:
```json
{
  "timestamp": "2026-11-12T10:15:30.123Z",
  "level": "INFO",
  "logger": "paymini.transfers",
  "request_id": "req_8fa134d1",
  "user_id": "c138d6d8-c70f-488f-9a4c-a3099903b41d",
  "event": "transfer_completed",
  "amount_paise": 25000,
  "transfer_id": "8fa134d1-8176-46b2-850c-e274640101c1"
}
```
*Rule of Financial Logging:* **Never log sensitive data**. Never log cleartext passwords, full JWT signatures, or personal identity numbers.

---

## 3. Database Maintenance & Backups

### 1. Automated Backups on Free Postgres (Neon / Supabase)
- Neon provides **point-in-time recovery (PITR)** up to 24 hours on free tiers.
- For manual peace-of-mind before schema migrations, trigger a logical pg_dump:
  ```bash
  pg_dump -d "$DATABASE_URL" -F c -b -v -f "paymini_backup_$(date +%F).dump"
  ```

### 2. Idempotency Table Cleanup
Idempotency records have a 24-hour expiration (`expires_at`). Over months of operation, this table will accumulate stale keys.
Set up a daily cron task or SQL job:
```sql
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

---

## 4. Secret Rotation Protocol

If your `SECRET_KEY` is accidentally exposed (e.g., committed to a public Git branch):
1. **Immediate Step:** In Render or Vercel dashboard, change `SECRET_KEY` to a new cryptographically random 64-character hex string.
2. **Impact:** All existing user JWTs will immediately fail signature validation (`Signature verification failed`).
3. **User Experience:** Users are redirected to `/login` to sign in again. No funds or database entries are compromised.
4. **Post-Mortem:** Remove the secret from Git history using `git-filter-repo` or BFG Repo-Cleaner.
