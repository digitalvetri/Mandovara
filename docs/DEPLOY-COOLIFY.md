# Deploy to Coolify — step by step

Target: production Mandovara Interior OS running on your Coolify server, using a Coolify-managed Postgres + Redis, with catalog images/PDFs on a persistent volume.

**Time to first deploy:** ~30 minutes (Coolify UI clicks) + ~10 minutes (first image upload) + ~5 minutes (image build).

**What travels through Git (already committed):**
- App source
- `Dockerfile` (multi-stage build, produces ~180 MB image)
- `.dockerignore`
- Prisma schema + migrations

**What does NOT travel through Git — you supply after first deploy:**
- Catalog images/PDFs in `public/catalog/` (~1 GB) — via SCP into a persistent volume
- Environment variables — via Coolify UI
- Database rows — via one-time `pnpm db:seed` inside the running container

---

## 1. Create the Coolify project (2 min)

1. Open your Coolify dashboard.
2. **+ New** → **Project** → name it `Mandovara`.
3. Inside the project, **+ New Resource** — you'll add three: **Database**, **Redis**, **Application** (in that order).

---

## 2. Add the Postgres service (3 min)

1. **+ New Resource** → **Database** → **PostgreSQL** → version **16**.
2. Name: `mandovara-db`.
3. Coolify auto-generates a user + password. **Deploy** and wait for green.
4. Click into the service → **Connection strings** tab. Copy the **Internal** URL (looks like `postgres://postgres:xxxxx@mandovara-db:5432/postgres`). Save it — this is your `DATABASE_URL`.

---

## 3. Add the Redis service (2 min)

1. **+ New Resource** → **Database** → **Redis** → version **7**.
2. Name: `mandovara-redis`.
3. **Deploy**. Copy the Internal URL from Connection strings: `redis://:xxxxx@mandovara-redis:6379`. Save as `REDIS_URL`.

---

## 4. Add the App service (5 min)

1. **+ New Resource** → **Public Repository** (or **Private** if you use GitHub App).
2. Repository URL: `https://github.com/digitalvetri/Mandovara`
3. Branch: `main`.
4. **Build pack:** `Dockerfile` — Coolify will find our `/Dockerfile`.
5. **Port:** `3000` (Coolify defaults to detecting this; confirm).
6. Name: `mandovara-app`.

Don't deploy yet — set env vars first (step 5) and the volume (step 6), otherwise the first boot will crash.

---

## 5. Set environment variables (3 min)

Open the app service → **Environment Variables** tab → add these:

| Key                | Value                                                             | Notes                                                     |
|--------------------|-------------------------------------------------------------------|-----------------------------------------------------------|
| `DATABASE_URL`     | (from step 2)                                                     | Pooled or direct — Coolify Postgres has no PgBouncer      |
| `DIRECT_URL`       | (same as DATABASE_URL)                                            | Prisma migrate uses this — fine to reuse                  |
| `REDIS_URL`        | (from step 3)                                                     | BullMQ needs it                                           |
| `SESSION_SECRET`   | run `openssl rand -hex 32` locally and paste                      | **64-char random hex — required. Rotating invalidates all sessions.** |
| `COOKIE_SECURE`    | `false` if the app is served over plain HTTP (e.g. sslip.io test URL) | **Leave unset (or `true`) once TLS is enabled.** Browsers refuse Secure cookies over HTTP; setting `false` while on HTTP is the only way login can succeed. |
| `NEXT_PUBLIC_APP_URL` | your app's public URL (get after step 7)                       | Fill after first deploy                                   |
| `NODE_ENV`         | `production`                                                      | Already set inside the Dockerfile too                     |
| `SENTRY_DSN`       | *(optional)* paste the DSN from sentry.io → Settings → Client Keys | Server + edge error capture. Leave unset if you don't want Sentry. |
| `NEXT_PUBLIC_SENTRY_DSN` | *(optional)* same value as `SENTRY_DSN`                     | Browser error capture. Only add if you also add `SENTRY_DSN`. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | *(optional)* only if you want source-map upload at build time | All three must be set together — otherwise the wrapper no-ops and next build proceeds untouched. |

Leave WhatsApp / GSP secrets empty for now — they only matter when Phase 6 / 8 code paths run.

> ⚠️ **Remove any `ALLOW_DEV_AUTH` env var if you set it earlier.** That escape hatch has been deleted from the code; leaving the variable in place does nothing but is misleading. The two ways in are a real email/mobile + password login and a mobile + 4-digit PIN login, both bcrypt-verified and both issuing an HMAC-signed session cookie. Both are rate-limited to 5 failed attempts per 15 minutes per identifier.

---

## 6. Add the persistent volume (2 min)

Same app service → **Storages** tab → **+ Add**:

- **Name:** `catalog-assets`
- **Mount path:** `/app/public/catalog`
- **Type:** Volume (Coolify manages the host path)

This survives redeploys. Everything in `/app/public/catalog` (including any PDFs and JPGs you upload later) persists.

---

## 7. First deploy (5 min)

1. Click **Deploy**.
2. Watch the build log — should see the three-stage Dockerfile: `deps` → `build` → `runtime`. First build takes ~4-5 min (pnpm install is the slow step; subsequent builds cache it).
3. When the container starts, `prisma migrate deploy` runs — you should see `Applying migration ...` lines followed by `The following migration have been applied`.
4. Coolify shows the service as green + gives you a URL (something like `https://mandovara-app-<random>.<your-coolify-host>`).
5. Go back and paste this URL as `NEXT_PUBLIC_APP_URL` in env vars. Click **Redeploy** for it to take effect.

Open the URL — you should hit `/login`. The DB is empty at this point.

---

## 8. Seed the database (one-time, 30 sec)

The app service in Coolify has an **Execute Command** button (or use `docker exec` via SSH to the Coolify server).

Run inside the container:

```sh
pnpm db:seed
```

This populates the org + branch + 3 users + catalog (~700 designs) + a few clients/projects/quotes so login + browse work immediately. Takes ~30 seconds.

Log in with the seeded credentials:
- **Mobile:** `9843012345` (Rohit — OWNER)
- **Password:** whatever the seed sets (check `prisma/seed/masters.ts` — usually the mobile itself for dev)

---

## 9. Upload catalog images + PDFs (~10 min for 1 GB)

Your local machine has `public/catalog/` with ~90 JPGs + 70 PDFs. Coolify won't have any of them.

**On your laptop** (from the repo root):

```powershell
# Find the Coolify volume path — from the Coolify UI: click the volume,
# it shows the host path (usually /data/coolify/applications/<uuid>/catalog-assets)
$COOLIFY_HOST = "your.coolify.server"
$VOLUME_PATH = "/data/coolify/applications/<paste-uuid>/catalog-assets"

scp -r public/catalog/* $COOLIFY_HOST:$VOLUME_PATH/
```

After upload finishes, refresh `/products` on the deployed URL — the Rugway rugs should now show their real cover images and the "Browse full catalogue" button should open the PDFs.

---

## 10. What you get + what's still manual

**Automatic on every future push to `main`:**
- Coolify pulls the new commit
- Rebuilds the Docker image (uses cache — usually 60-90 seconds)
- Applies any new Prisma migrations
- Restarts with zero downtime

**Still manual (for now):**
- New catalog PDFs need `scp` to the volume + a run of `scripts/build-catalog-images.ts` inside the container to regenerate covers
- Env var changes require a redeploy
- Rollback: Coolify has a **Redeploy from previous commit** button

---

## Domain (skipped — do this later)

When you have a domain:

1. DNS: A record → your Coolify server's public IP.
2. In Coolify → app service → **Domains** tab → add the domain.
3. Coolify auto-issues a Let's Encrypt cert (30 sec).
4. Update `NEXT_PUBLIC_APP_URL` env var → redeploy.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails at `pnpm install --frozen-lockfile` | Your local `pnpm-lock.yaml` isn't committed. Run `git add pnpm-lock.yaml && git push`. |
| Migrations fail with `advisory lock` timeout | Two container instances are racing. Scale replicas to 1 during deploys. |
| `Cannot find module '.prisma/client'` at runtime | The Dockerfile references a specific pnpm hash in `.pnpm/@prisma+client@6.19.0_prism_*`. If you upgrade Prisma, that path changes — update the Dockerfile. |
| Images show hex tiles instead of photos | You haven't uploaded `public/catalog/` yet — see step 9. |
| "The catalogue is empty" on `/products` | Run `pnpm db:seed` inside the container (step 8). |

## Rollback strategy

Coolify keeps every previous image build. To roll back:
1. App service → **Deployments** tab
2. Find the last-known-good deployment
3. Click **Redeploy** on that row

Data (DB rows, uploaded files) is unaffected — only the app code reverts.

---

## Postgres backups

**Automated schedule (recommended):**

1. Coolify dashboard → **Databases** → open the `mandovara-postgres` service
2. **Backups** tab → **+ Add scheduled backup**
3. Configure:
   - **Schedule:** `0 21 * * *` (03:00 IST = 21:30 UTC — adjust if your VPS is not UTC)
   - **Retention:** 14 days
   - **Storage:** local Coolify volume (fine for MVP; add S3 later when the DB grows past a few GB)
4. Click **Save** → hit **Run backup now** to verify the first one completes green.

Coolify stores each backup under `/data/coolify/backups/` on the VPS. Restore is one click from the same UI (Backups tab → pick a backup → **Restore**).

**On-demand manual backup** (from Coolify's web terminal on the Postgres service):

```sh
pg_dump -U postgres mandovara \
  | gzip > /tmp/mandovara-$(date -u +%Y%m%dT%H%M%SZ).sql.gz
```

Then copy it off the VPS: `docker cp <pg-container>:/tmp/mandovara-XXXX.sql.gz ./` from an SSH session on the host.

**Restore a manual dump:**

```sh
gunzip -c mandovara-YYYYMMDDTHHMMSSZ.sql.gz \
  | docker exec -i <pg-container> psql -U postgres mandovara
```

