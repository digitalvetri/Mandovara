# Coverage Matrix — §12 acceptance vs live tests

Where every §12 (CLAUDE.md) line is proven today. Use this table
before shipping to a customer environment; anything marked `⏭`
below is a known gap (with the reason) rather than a bug.

Legend:
- ✅ · covered by a real test file (linked)
- 🧪 · covered by a scripted smoke — proves the same business flow
  but not through the UI; §14 gates accept these
- ⏭ · deferred, with reason
- ⚠︎ · partially covered — see notes

---

## §12.1 — Unit tests (Vitest)

| Line | Coverage | Where |
|---|---|---|
| 100% branch on `/lib/calc` | ✅ | `tests/lib/calc/{curtain,wallpaper,flooring}.test.ts` |
| GST intra/inter/exempt/mixed | ✅ | `tests/kernel/tax/gst.test.ts` |
| `formatINR` / `parseINR` money math | ✅ | `tests/kernel/money/{format,paise}.test.ts` |
| Unit conversions | ✅ | `tests/kernel/datetime.test.ts` (fy + IST) |
| Numbering: 1,000 parallel, no gaps | ✅ | `tests/kernel/concurrency/numbering.test.ts` |
| Dye lot: mixed-lot throws without override | ✅ | `tests/modules/allocation/mixed-lot-audit.test.ts` |
| Payroll: LOP + statutory slabs read from DB | 🧪 | `scripts/smoke-payroll-recon.ts` — 10 employees × 3 structures reconcile to paisa |

---

## §12.2 — E2E (Playwright)

| # | Scenario | Coverage | Where |
|---|---|---|---|
| 1 | Enquiry → measurement → mobile offline → sync → quote → send WhatsApp → accept → order | 🧪 | `scripts/smoke-cut-list-identity.ts` (measurement→quote→order sub-chain) + `scripts/smoke-whatsapp-gate.ts` (WhatsApp send); UI-driven E2E deferred (chained flow across 6+ pages) |
| 2 | Order → PO → GRN dye lot → allocate → make → cut list → install → signature → invoice → receipt | 🧪 | `scripts/smoke-{make-transitions,install-visit,cut-list-identity,phase6-money}.ts` cover every sub-transition; UI-driven E2E deferred |
| 3 | **Wallpaper offset repeat: verify rolls + warning; free match: rolls drop** | ✅ | `tests/e2e/wallpaper-calc.spec.ts` |
| 4 | **Mixed-lot allocation blocked; override with reason; audit row** | ✅ | `tests/e2e/mixed-lot.spec.ts` + `tests/modules/allocation/mixed-lot-audit.test.ts` |
| 5 | Sample library: issue book, overdue nudge, holder visible | ⏭ | No samples module yet (§8 spec item; not shipped) |
| 6 | INSTALLER login: cost + margin absent from any network response | ⏭ | Auth is dev-context stub; real login lands with the auth slice |

---

## §12.3 — Isolation suite

| Line | Coverage | Where |
|---|---|---|
| Cross-org read returns zero rows | ✅ | `tests/kernel/scoping.test.ts` (28 tests across every tenant-scoped model) |
| Every route × every role | ⚠︎ | RBAC unit-tested (`tests/kernel/rbac.test.ts`); route-level middleware guard deferred with the auth slice |

---

## §14 phase gates — proof of life

Every phase's ✅ gate has a matching smoke script committed with
the phase:

| Phase | Gate | Smoke |
|---|---|---|
| 5a | Cut-list identity across 4 hops | `scripts/smoke-cut-list-identity.ts` |
| 5b | Make lifecycle transitions | `scripts/smoke-make-transitions.ts` |
| 5c | Install visit offline PWA | `tmp/verify-5c-pwa.mjs` (Playwright) |
| 6a | Cheque bounce + receipt residual + advance adjust | `scripts/smoke-phase6-money.ts` |
| 6b | Architect commission freeze | `scripts/smoke-architect-commission.ts` |
| 6c | Profitability reconciles to paisa | `scripts/smoke-profitability.ts` |
| 7a | Payroll reconciles to paisa | `scripts/smoke-payroll-recon.ts` |
| 7b | Attendance PWA offline | `tmp/verify-7b-pwa.mjs` (Playwright) |
| 8a | WhatsApp template gate + cost | `scripts/smoke-whatsapp-gate.ts` |

---

## Running the suite

```bash
pnpm test              # unit + integration (Vitest + Testcontainers)
pnpm test:e2e          # Playwright (chromium)
pnpm tsx scripts/smoke-<name>.ts   # any individual smoke
```

The dev server auto-starts for `test:e2e` (see `playwright.config.ts`
`webServer.command`). Playwright's `mobile-android` project is
declared but the CI focus is chromium; native mobile testing is a
real-device task, not a headless one.

---

## Known coverage gaps + why

- **Full chained E2E for §12.2 #1 and #2.** Each step in the chain
  is proven by its own smoke; a single Playwright spec that
  navigates every UI in the chain is 500+ lines of brittle wait-
  and-click. Deferred until Phase 8d ("restore + re-run E2E against
  a clean env") turns the smokes into a scripted end-to-end run.
- **§12.2 #5 (sample library)** — no samples module yet.
- **§12.2 #6 (INSTALLER role hides cost)** — needs real auth. The
  server-side permission guard (`requirePermission`) is unit tested;
  the client-side data hiding via role filtering is dev-context-only
  until login lands.
- **Backup + restore drill (§14 Phase 8 gate)** — deferred to 8d.
