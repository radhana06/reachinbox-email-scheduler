# ReachInbox – Email Job Scheduler (Backend + Dashboard)

Schedules emails with **BullMQ delayed jobs (no cron)**, sends via **Ethereal SMTP**, persists in **PostgreSQL**, indexes in **Elasticsearch**, rate-limits with **Redis**, and has a **React + Tailwind** dashboard with Google login and Slack alerts.

## 1. Prerequisites
- Node.js 20+  (https://nodejs.org)
- Docker Desktop (for Redis, Postgres, Elasticsearch)

## 2. Start infrastructure
```bash
docker compose up -d
```
(Elasticsearch needs ~1 min to boot. Check: http://localhost:9200)

## 3. Google OAuth setup (5 min)
1. https://console.cloud.google.com → create a project.
2. **APIs & Services → OAuth consent screen** → External → fill app name + your email → add yourself under *Test users*.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. **Authorized redirect URI**: `http://localhost:4000/auth/google/callback`
5. Copy Client ID + Secret into `backend/.env`.

## 4. Slack OAuth setup (5 min)
1. https://api.slack.com/apps → **Create New App → From scratch** → pick a workspace.
2. **OAuth & Permissions → Redirect URLs** → add `http://localhost:4000/auth/slack/callback`
   (if Slack rejects http, run `ngrok http 4000`, put the https URL in `BACKEND_URL` and use that redirect URL instead).
3. **Scopes → Bot Token Scopes** → add `incoming-webhook`.
4. **Basic Information** → copy Client ID + Client Secret into `backend/.env`.

## 5. Run the backend
```bash
cd backend
cp .env.example .env      # then fill in Google + Slack values and a JWT_SECRET
npm install
npm run dev               # API + worker in one process
```
On first boot it creates DB tables, the ES index and **3 Ethereal sender accounts** automatically (needs internet).
- API: http://localhost:4000
- **Live BullMQ dashboard: http://localhost:4000/admin/queues**
- Optional separate worker process (scale-out): set `RUN_WORKER=false` on the API and run `npm run worker` elsewhere.

## 6. Run the frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

## 7. Try it
1. Open http://localhost:5173 → **Login with Google**.
2. **Compose New Email** → subject, body, upload `sample-leads.csv`, start in ~1 minute, delay 5 s → **Schedule**.
3. Watch the *Scheduled* tab, then *Sent* tab (click **preview** to see the email on ethereal.email).
4. Click **Connect Slack**, then schedule 10 emails with **hourly limit = 2** → Slack message arrives when the limit hits and the rest are moved to the next hour.
5. Restart test: schedule emails 3 min ahead → Ctrl+C backend → start again → they still send.

## Architecture
```
React ──► Express API ──► Postgres (source of truth: emails, senders, users, slack)
                 │──► Elasticsearch (search index)
                 └──► BullMQ queue (Redis) ──► Worker(s) ──► Ethereal SMTP
                                 └─ Redis counters: rate:<sender>:<hour>
```

### How scheduling works
`POST /api/emails/schedule` inserts one row per recipient (`scheduled_at = start + i × delay`, sender chosen round-robin) in a DB transaction, then enqueues a **BullMQ delayed job** per email with `jobId = email-<id>`. No cron anywhere.

### Persistence on restart
Delayed jobs live in Redis (AOF enabled in docker-compose) and rows live in Postgres. On restart the worker simply resumes; delayed jobs fire at their original time. On boot, `recoverMissingJobs()` re-creates any `scheduled` DB row whose job is missing from Redis (e.g. Redis was wiped).

### Idempotency (no duplicate sends)
1. Deterministic `jobId` → enqueueing twice is a no-op.
2. Worker skips rows already `sent/failed`.
3. Atomic `UPDATE … SET status='processing' WHERE status='scheduled'` claim — only one worker can win.
4. Stale `processing` rows (crashed worker) can be re-claimed after 2 minutes.

### Concurrency & delay between sends
- `WORKER_CONCURRENCY` (default 5) = parallel jobs per worker process.
- `MIN_DELAY_MS` (default **2000 ms**) via BullMQ `limiter {max:1, duration: MIN_DELAY_MS}` → at most one send *starts* every 2 s, **across all workers**.

### Hourly rate limit
- Per **sender**, limit from the compose form (falls back to `MAX_EMAILS_PER_HOUR_PER_SENDER`).
- Redis key `rate:<senderId>:<hourWindow>` with atomic `INCR` (TTL 2 h) → safe across many workers/instances.
- If `count > limit`: `DECR`, then `job.moveToDelayed(startOfNextHour + id%1000ms)` and throw `DelayedError`. The job is **not dropped or failed**; the +id offset keeps ordering. DB `scheduled_at` is updated so the UI shows the new time.
- **Slack:** at that moment a real message is POSTed to the user's Slack webhook (obtained via OAuth). One alert per sender per hour (Redis `SET NX`). If Slack isn't connected: silent no-op; connecting later works immediately (webhook read from DB at notify time).

### Behaviour under load (1000+ emails at the same time)
All 1000 jobs sit in Redis as delayed jobs. When due, the limiter releases one per 2 s, 5 at a time; each sender stops at its hourly cap and overflow jobs hop to the next hour window. Nothing is lost; the queue just drains slower. More throughput = more sender accounts and/or more worker processes.

### Search
Every scheduled email is indexed into Elasticsearch (`emails` index); sent status is updated on send. `GET /api/emails/search?q=...&status=scheduled|sent`. The dashboard search box uses it.

## Features → requirements
| Requirement | Where |
|---|---|
| Schedule API, relational DB | `routes/emails.ts`, `scheduler.ts`, `db.ts` |
| BullMQ delayed jobs, no cron | `queue.ts`, `scheduler.ts` |
| Ethereal SMTP, multiple senders | `mailer.ts`, `bootstrap.ts` |
| Persistence/restart, idempotency | `scheduler.ts#recoverMissingJobs`, `worker.ts` |
| Concurrency, min delay, hourly limit | `worker.ts`, `config.ts` |
| Slack OAuth + live notification | `routes/auth.ts`, `slack.ts`, `SlackButton.tsx` |
| Elasticsearch search | `elastic.ts` |
| Live BullMQ dashboard | `/admin/queues` (bull-board) |
| Google login, header, logout | `routes/auth.ts`, `Login.tsx`, `Header.tsx` |
| Compose + CSV parsing | `ComposeModal.tsx`, `lib/utils.ts` |
| Scheduled / Sent tables, loading + empty states | `Dashboard.tsx`, `EmailTable.tsx` |

## Assumptions / trade-offs
- Senders are global Ethereal accounts (auto-created), not per-user.
- The BullMQ limiter is global to the queue (simple, safe), not per sender; per-sender caps come from the Redis counters.
- `/admin/queues` is unauthenticated (add auth before real deployment).
- Slack uses an incoming-webhook (channel chosen during OAuth) rather than a bot token.
- Auth is a JWT in an httpOnly cookie; frontend & backend must be same-site (localhost in dev).
- UI follows the assignment layout; tweak colours/spacing in the components to match your Figma exactly.

## Deploying (single service on Render)
The backend also serves the built dashboard, so the whole app lives on **one https URL** (no CORS / cross-site cookie issues).

| Piece | Service | Env var |
|---|---|---|
| Postgres | Neon | `DATABASE_URL` (include `?sslmode=require`) |
| Redis | Redis Cloud (free, persistent) | `REDIS_URL` (`redis://default:<pw>@host:port`, or `rediss://` if TLS) |
| Elasticsearch | Bonsai / Elastic Cloud | `ELASTIC_URL` (`https://user:pass@host`) or `ELASTIC_API_KEY` |
| App (API + worker + dashboard) | Render Web Service | see below |

Render settings: Build `cd frontend && npm ci && npm run build && cd ../backend && npm ci && npm run build` - Start `cd backend && npm start`.
Set `BACKEND_URL` and `FRONTEND_URL` both to the Render URL, add `<URL>/auth/google/callback` in Google and `<URL>/auth/slack/callback` in Slack.
