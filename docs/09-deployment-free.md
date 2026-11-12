# 09 — Free-Tier Deployment Guide (Checked November 2026)

This document provides a realistic, practical guide for deploying **Paymini** to production on zero-cost cloud tiers.

> [!NOTE]
> Free-tier policies and service quotas change frequently across cloud providers. The information in this document was verified against current official documentation as of **November 2026**.

---

## 1. Recommended Architecture for Free-Tier Deployment

```
                    Internet (Users)
                           |
                           v
        +--------------------------------------+
        |      VERCEL / NETLIFY (Frontend)     |
        |  - Next.js 14 App Router (Edge/SSR)  |
        |  - Free Hobby Tier (No credit card)  |
        |  - Serves UI & Route Handler BFF     |
        +--------------------------------------+
                           |
                           | HTTPS Private / Public API Calls
                           v
        +--------------------------------------+
        |      RENDER / RAILWAY (Backend)      |
        |  - FastAPI (Python 3.12 Docker)      |
        |  - Free Web Service / Hobby Tier     |
        |  - Cold Start: 30-50s after idling   |
        +--------------------------------------+
                           |
                           | PostgreSQL Connection (Port 5432)
                           v
        +--------------------------------------+
        |       NEON / SUPABASE (Database)     |
        |  - Serverless PostgreSQL 16          |
        |  - Free Tier: 0.5 GB storage         |
        |  - Auto-sleep / Scale to Zero        |
        +--------------------------------------+
```

---

## 2. Platform Comparison & Limits (Checked Nov 2026)

| Layer | Platform | Free Tier Specifications | Limitations & Realities |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Vercel** | - 100 GB Bandwidth / month<br>- Unlimited serverless function invocations for hobby projects | Next.js first-party support. Excellent edge network. |
| **Backend** | **Render** | - 512 MB RAM, 0.1 CPU<br>- 750 free instance hours / month | **Spins down after 15 minutes of inactivity.** Initial spin-up (cold start) takes 30–50 seconds. |
| **Backend** | **Railway** | - \$5 monthly free credit trial (varies by region/verification) | Faster builds, but requires credit monitoring. |
| **Database**| **Neon.tech**| - 0.5 GB storage<br>- Serverless Postgres with pooling | Computes suspend after 5 minutes of inactivity. Reconnect takes ~1-2 seconds. |
| **Database**| **Supabase**| - 500 MB database storage<br>- 2 free projects | Pauses projects after 7 days of inactivity. |

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Provision the Cloud PostgreSQL Database (Neon)
1. Sign up at [neon.tech](https://neon.tech).
2. Create a new project named `paymini-db` (select PostgreSQL 16 and a region close to your users, e.g. Singapore or Frankfurt).
3. Copy the pooled connection string:
   ```text
   postgresql://user:password@ep-sample-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Deploy the FastAPI Backend (Render)
1. Fork or push your `wallet-proj` repository to GitHub.
2. Sign in to [render.com](https://render.com) and click **New > Web Service**.
3. Connect your GitHub repository.
4. Configure settings:
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt && alembic upgrade head`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add Environment Variables:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `SECRET_KEY`: Generate a random 64-char key (`openssl rand -hex 32`).
   - `ENVIRONMENT`: `production`
   - `CORS_ORIGINS`: `["https://your-frontend.vercel.app"]`
6. Click **Create Web Service**. Wait for Alembic migrations to apply and status to show `Live`.

### Step 3: Deploy the Next.js Frontend (Vercel)
1. Sign in to [vercel.com](https://vercel.com) and import your GitHub repository.
2. Configure settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Next.js`
3. Add Environment Variables:
   - `BACKEND_INTERNAL_URL`: Your Render backend URL (`https://paymini-api.onrender.com`).
   - `NEXT_PUBLIC_APP_ENV`: `production`
4. Click **Deploy**.

---

## 4. Cold Starts and How to Handle Them

### The Reality of Free Hosting
On Render and Neon free tiers, containers and database instances suspend when idle. When an interviewer or evaluator visits your deployed URL:
1. The first request will hang for **30 to 50 seconds** while Render spins up the container and Neon wakes up the Postgres database.
2. Subsequent requests run at normal speed (< 100ms).

### Recommended Mitigation in UI
Paymini includes calm, informative UI states:
- If a request takes longer than 2 seconds, the frontend shows an inline notice:
  *"Connecting to secure banking engine (cloud instances may take up to 40 seconds to spin up from sleep on free tier)..."*
- This transparently sets expectations and demonstrates that you understand cloud infrastructure economics.

---

## 5. Security & Cookie Domain Configuration

When deploying frontend and backend to different domains (e.g. `paymini.vercel.app` and `paymini-api.onrender.com`):
- **Why Paymini's BFF Pattern Excels:** Because the browser communicates exclusively with Vercel (`paymini.vercel.app/api/proxy`), cookies are always **first-party**. 
- The browser never performs cross-origin cookie sharing, preventing third-party cookie blocking in modern browsers (Safari ITP, Chrome Privacy Sandbox).
