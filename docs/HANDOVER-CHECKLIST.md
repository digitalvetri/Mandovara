# Handover Checklist — Mandovara Interior OS

One-page checklist for handing this application over to Mandovara. Work through it top-to-bottom; each item is either **required** (blocks handover) or **recommended** (do soon after).

---

## Required before handover

- [ ] **Set `APP_DB_PASSWORD` and `APP_DATABASE_URL` on Coolify** — §3.2 Row-Level Security only applies when the app connects as the restricted `mandovara_app` role. If `APP_DATABASE_URL` is unset the app falls back to the database owner and **RLS is silently not enforced**. The container entrypoint creates/rotates the role from `APP_DB_PASSWORD` and aborts if only one of the pair is set. See `docs/DECISIONS.md`.
- [ ] **Set `SESSION_SECRET` on Coolify** — 64-char hex from `openssl rand -hex 32`. Rotating this invalidates every logged-in session. See DEPLOY-COOLIFY.md §5.
- [ ] **Set `COOKIE_SECURE=false` on Coolify** — required while running over plain HTTP (sslip.io). Remove once TLS lands. Without this, login silently fails.
- [ ] **Remove `ALLOW_DEV_AUTH` from Coolify** — the escape hatch has now genuinely been deleted from the code (it was still live and still gating the since-removed PIN login when this line first claimed otherwise). The variable is dead weight; remove it. `grep -rn ALLOW_DEV_AUTH src/` returns nothing.
- [ ] **Seed the production database** — `docker exec <app-container> node /app/scripts/prod-reset-catalog.mjs` from Coolify's web terminal. See DEPLOY-COOLIFY.md §8.
- [ ] **Enable Coolify Postgres backups** — Databases → mandovara-postgres → Backups → add a daily schedule. See DEPLOY-COOLIFY.md "Postgres backups" section.
- [ ] **Distribute staff credentials** — email/mobile + the temporary password `Mandovara@2026`. Every seeded account is flagged `mustChangePassword=true`, so each staff member is forced to pick their own password on first sign-in.

## Required before real client data goes in

- [ ] **TLS** — point a real domain (e.g. `app.mandovara.com`) at `147.93.105.212`, enable Let's Encrypt in Coolify. Then delete `COOKIE_SECURE=false` from env. See `docs/DEPLOY-TLS.md`.
- [x] **Dye-lot UI restored** — `/purchase/allocation` is back in the sidebar with the mixed-lot gate rendered as a red inline block (§6.3.6). Covered by `tests/e2e/s4-dye-lot-gate.spec.ts`.

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

- **Sign-in is not rate-limited.** Login throttling was removed on request; failed password attempts are unlimited. Put a rate limit in front of `/login` at the proxy before this is reachable from the public internet.
- **Mobile + 4-digit PIN sign-in has been removed.** Field staff sign in with email/mobile + password like everyone else.
- **Made-to-measure lines can be quoted against a bare lead** with no `MeasurementItem`. This is a deliberate exemption from CLAUDE.md non-negotiable #1, which otherwise forbids it; client-scoped quotations are still gated. A quote raised from a lead is an estimate, and the quantities on it have not come from a site measurement.
- WhatsApp integration is scaffolded but not wired to a Meta WABA — see CLAUDE.md §9 for what needs to be turned on before it works. Until then, the /accounts chase list uses a `wa.me` deep-link (opens WhatsApp with a pre-composed message; Rohit still hits Send) — works today, no template approval needed. Templates, per-message cost logging and the service-window countdown now have seed data, but nothing dispatches automatically.
- HR: attendance and payroll pages exist and are seeded (45 days of attendance with month-lock, an approved payroll run with payslips). Offline punch from the field is still deferred — see the Phase 7 entry in docs/DECISIONS.md.
- E-invoicing (IRN/GST portal) is schema-complete, actual submission flow not wired.
- Measurement offline sync passes local tests but hasn't been validated on a real Android device in poor connectivity.
- **§7 calculation constants are still spec defaults, not Mandovara's.** Fullness ratios, hem and heading allowances, wastage percentages, eyelet spacing, minimum blind charge and standard fabric/roll widths have NOT been validated against 20 historical jobs with their tailor, installer and store keeper. This is the outstanding Phase 0 gate and it directly affects quoted quantities.
- 14 files still exceed the §10 300-line limit. They carry explicit
  `eslint-disable max-lines -- FIXME` comments naming the count; the rule stays
  enforced so the debt is visible rather than silently excluded.
- `AuditLog` is intentionally empty in the seed — it is written by the
  application at runtime, and fabricating an audit trail would be worse than
  leaving it empty.
- Four of the six §12.2 e2e scenarios are page-level coverage rather than full
  transactional walkthroughs. Scenarios 4 (dye-lot gate) and 6 (installer sees
  no cost/margin) are implemented end to end.

### /accounts redesign — what shipped, what's pending

- ✅ Six phases of `docs/ACCOUNTS-PAGE.md` are live: plain-language dictionary, chase-score kernel (33 boundary tests), Overview shell with 4 KPI cards + Chase List + 4 bar charts + Attention strip, 3-tap Record Payment sheet, four detail tabs (To Collect / Received / To Pay / Spending), first-run tour.
- ⏳ **Bulk reminders** ("send a reminder to every 60+ days late client") from the To Collect tab — deferred. The single-row WhatsApp button in Chase List does the job for now, one client at a time.
- ⏳ **Vendor-payment tracking** on the To Pay tab — Expense rows have a "Mark paid" button (schema field added in Phase 1); PurchaseOrder rows don't, because the PO status enum tracks receipt-of-goods (`SENT → PARTIAL → RECEIVED`), not payment-of-money. Proper vendor payment needs a schema addition (`PurchaseOrder.paidAt` or a separate `VendorPayment` model).
- ⏳ **Materialized view for `client_outstanding`** — spec §12 proposed one for scale; kept in reserve. Current shape is a batched Prisma query, fast enough at <1k open invoices per org. Bring the MV in when the Overview load starts crossing 1.5s on real data.
- ⏳ **`Undo` toast** on the Payment sheet (spec §8) — a receipt-reversal action wrapping bounceReceipt-style logic would let a mis-click get taken back within 8s. Skipped for MVP.
- ⏳ **Live perf measurement** — do this against the deployed prod once it has 24 months of real receipts. Chrome DevTools → Performance → record → open /accounts → confirm the four KPI numbers appear inside 1.5s and paste the network trace into a follow-up commit if you want a record.

## Support

- Bugs / feature requests: file an issue in the GitHub repo
- Deployment help: DEPLOY-COOLIFY.md is the single source of truth for infra steps
- Data recovery: restore from the most recent Coolify backup (Backups tab → Restore)
