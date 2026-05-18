# IshVenom Deployment Guide

Target stack:

| Service | Platform | Notes |
|---|---|---|
| Database | Neon | Postgres 16 + PostGIS 3, managed, free tier |
| Backend API | Render | Docker-based, `services/api/Dockerfile` |
| Dashboard | Vercel | Next.js 14, root dir `apps/dashboard` |

Do these steps in order — the Render URL is needed before Vercel, and the
Vercel URL is needed before updating Render's `CORS_ORIGIN`.

---

## 1. Provision Neon Postgres with PostGIS

1. Create an account at https://neon.tech and create a project named `ishvenom`.
   Choose `eu-central-1` (Frankfurt) for the best latency balance between
   West Africa, East Africa, and EU reviewers.

2. In the Neon dashboard, create a database called `ishvenom`.

3. Enable PostGIS.  Open the Neon SQL editor and run:

   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   SELECT PostGIS_Version();
   ```

4. Copy two connection strings from the Neon dashboard:
   - **Pooled** (`DATABASE_URL`) — used by the API at runtime.
   - **Direct** (`DIRECT_URL`) — used by `prisma migrate deploy` (bypasses pooler).

5. From your local machine, run the migrations:

   ```bash
   cd services/api
   cp .env.example .env
   # paste DATABASE_URL and DIRECT_URL into .env
   pnpm prisma:generate
   pnpm prisma migrate deploy
   ```

---

## 2. Deploy the API to Render

1. Create an account at https://render.com and connect your GitHub account.

2. **New + → Web Service → Connect a repository → ishvenom**.

3. Configure the service:

   | Field | Value |
   |---|---|
   | Name | `ishvenom-api` |
   | Region | Frankfurt (EU Central) |
   | Branch | `main` |
   | Root Directory | *(leave blank — Dockerfile is at repo root)* |
   | Runtime | **Docker** |
   | Dockerfile path | `services/api/Dockerfile` |
   | Instance type | Free (or Starter $7/mo for zero cold-start) |

4. Add environment variables in Render → Environment:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `DATABASE_URL` | Neon pooled connection string |
   | `DIRECT_URL` | Neon direct connection string |
   | `SESSION_SECRET` | 48 random bytes — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `REGISTRATION_INVITE_TOKEN` | 32+ char secret — share out-of-band with dashboard users |
   | `CORS_ORIGIN` | `https://<your-vercel-url>.vercel.app` (set this after step 3) |
   | `LOG_LEVEL` | `info` |

5. Click **Create Web Service**.  Render builds the Docker image and assigns a URL like:
   `https://ishvenom-api.onrender.com`

6. Test the health check:

   ```bash
   curl https://ishvenom-api.onrender.com/api/v1/health
   # → {"ok":true,"version":"0.1.0","uptime":...}
   ```

> **Cold-start note:** The Render free tier spins down after 15 minutes of
> inactivity and takes ~50 s to restart.  For the hackathon demo, either
> upgrade to Starter ($7/mo) or keep the service warm with a scheduled
> ping (e.g. a cron job or UptimeRobot free monitor hitting `/api/v1/health`
> every 10 minutes).

---

## 3. Deploy the dashboard to Vercel

1. Create an account at https://vercel.com and link your GitHub.

2. **Add New → Project → Import Git Repository → ishvenom**.

3. When prompted for **Root Directory**, enter `apps/dashboard`.
   Vercel will auto-detect Next.js 14.

4. Add one environment variable:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE` | `https://ishvenom-api.onrender.com/api/v1` |

5. Click **Deploy**.  Vercel assigns a URL like `https://ishvenom.vercel.app`.

6. Go back to Render and update `CORS_ORIGIN` to the exact Vercel URL
   (no trailing slash).  The API restarts automatically.

---

## 4. Create the first dashboard user

Registration is gated by `REGISTRATION_INVITE_TOKEN` in production:

```bash
curl -X POST https://ishvenom-api.onrender.com/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "you@example.com",
    "password": "a-strong-password",
    "inviteToken": "<your REGISTRATION_INVITE_TOKEN>"
  }'
```

Then visit the Vercel URL, sign in, and the dashboard is live.

---

## 5. Pre-demo checks

- [ ] `GET /api/v1/health` returns `200 {"ok":true}`
- [ ] `POST /api/v1/auth/register` without invite token returns `403`
- [ ] Dashboard login, hard-refresh, and logout all work
- [ ] Map page loads without console errors on a fresh browser profile
- [ ] `POST /api/v1/encounters` with an empty body returns `400` (not `500`)
- [ ] Render logs are JSON (Pino) and contain no PII

---

## 6. Mobile EAS build

After Render is deployed:

1. Set `EXPO_PUBLIC_API_URL` in your EAS Secrets:

   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_API_URL \
     --value https://ishvenom-api.onrender.com
   eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_AI_KEY \
     --value <your Google AI key>
   ```

2. Build and download the APK:

   ```bash
   eas build --platform android --profile production
   ```

---

## 7. Rollback

Both Render and Vercel keep a full deployment history.  Rollback is a one-click
operation in either dashboard.

For the database: Neon provides point-in-time recovery (7-day window on the free
tier).  **Do not run destructive migrations in the final week** — additive changes
only, or use the expand–contract pattern across three separate deploys.
