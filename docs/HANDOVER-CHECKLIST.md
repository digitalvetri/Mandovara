# Handover Checklist — Mandovara Interior OS

One-page checklist for handing this application over to Mandovara. Work through it top-to-bottom; each item is either **required** (blocks handover) or **recommended** (do soon after).

---

## Required before handover

- [ ] **Set `SESSION_SECRET` on Coolify** — 64-char hex from `openssl rand -hex 32`. Rotating this invalidates every logged-in session. See DEPLOY-COOLIFY.md §5.
- [ ] **Set `COOKIE_SECURE=false` on Coolify** — required while running over plain HTTP (sslip.io). Remove once TLS lands. Without this, login silently fails.
- [ ] **Remove `ALLOW_DEV_AUTH` from Coolify** — the escape hatch was deleted from the code; the variable is dead weight. Confirm nothing else references it.
- [ ] **Seed the production database** — `docker exec <app-container> node /app/scripts/prod-reset-catalog.mjs` from Coolify's web terminal. See DEPLOY-COOLIFY.md §8.
- [ ] **Enable Coolify Postgres backups** — Databases → mandovara-postgres → Backups → add a daily schedule. See DEPLOY-COOLIFY.md "Postgres backups" section.
- [ ] **Distribute staff credentials** — email/mobile + the temporary password `Mandovara@2026`. Every seeded account is flagged `mustChangePassword=true`, so each staff member is forced to pick their own password on first sign-in.

## Required before real client data goes in

- [ ] **TLS** — point a real domain (e.g. `app.mandovara.com`) at `147.93.105.212`, enable Let's Encrypt in Coolify. Then delete `COOKIE_SECURE=false` from env. See `docs/DEPLOY-TLS.md`.
- [ ] **Restore dye-lot UI** — removed from the sidebar/allocation console earlier per request. CLAUDE.md §0.6 lists this as a non-negotiable for interior furnishing operations (mixed-lot allocation = the "wallpaper doesn't match" incident).

## Recommended within the first week

- [ ] **Set up Sentry** — free tier at sentry.io → create a Next.js project → paste the DSN as `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser) on Coolify → redeploy. Optional: also set `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` for source-map upload.
- [ ] **First backup verification** — trigger a manual backup after 24 hours of use, restore it to a scratch database, log in and spot-check that a quotation and its lines are intact.
- [ ] **Test on a real Android phone** — the measurement PWA is the field surface. Confirm it installs to the home screen, works offline for a 4-room villa, and syncs cleanly when the phone rejoins wifi.

## Nice to have

- [ ] **Structured logging destination** — Coolify's log stream is fine for dev; wire logs to a rotating file or a log service (Better Stack, Papertrail) for production audit.
- [ ] **Monitoring dashboard** — Coolify shows container health; consider Uptime Kuma or a simple `/api/health` check from an external prober.
- [ ] **On-boarding doc for staff** — one page per role (Owner, Designer, Sales, etc.) with screenshots of the primary tasks.

---

## Known limitations at handover (be honest with the client)

- WhatsApp integration is scaffolded but not wired to a Meta WABA — see CLAUDE.md §9 for what needs to be turned on before it works.
- HR module (attendance, payroll) is schema-complete but no UI yet.
- E-invoicing (IRN/GST portal) is schema-complete, actual submission flow not wired.
- Measurement offline sync passes local tests but hasn't been validated on a real Android device in poor connectivity.

## Support

- Bugs / feature requests: file an issue in the GitHub repo
- Deployment help: DEPLOY-COOLIFY.md is the single source of truth for infra steps
- Data recovery: restore from the most recent Coolify backup (Backups tab → Restore)
