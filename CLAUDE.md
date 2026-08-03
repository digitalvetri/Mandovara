# Mandovara Business OS

Custom ERP for Mandovara, a Tamil Nadu trading and project-execution company.
16 modules: leads, clients, 1,000+ SKU catalog, quotations, purchase, stock,
sales orders, projects, GST invoicing, accounts, attendance, payroll,
WhatsApp automation, dashboards, admin.

Full specification: docs/BUILD-SPEC.md
Screen-by-screen UI: docs/UI-Build-Specification.md

## Who this is for

Five people. Build for them, not for a demo.

- Storekeeper — godown, weak signal, ₹9,000 Android, enters 40 GRN lines a day
- Accounts clerk — desk, keyboard only, reconciles 200 invoices a month
- Sales executive — on the road, phone, standing in front of a customer
- Site engineer — project site, no signal, dusty hands
- Rohit Vaid (MD) — 10 minutes each morning, on a phone

The first four use this 200 times a day. Every animation is a tax they pay
200 times. The fifth needs it to feel like a serious instrument — which comes
from precision, not decoration.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4
(CSS-first, @theme in globals.css, NO tailwind.config.js) · shadcn/ui
new-york style (no forwardRef, data-slot, sonner not toast) · PostgreSQL 16 ·
Prisma 6 · Zod 4 · react-hook-form · TanStack Table v8 · BullMQ + Redis ·
WhatsApp Cloud API · Vitest + Playwright · pnpm

Deliberately NOT used: any state management library (RSC + URL state +
useOptimistic is sufficient), GraphQL, any component library besides shadcn/ui,
date-fns or moment (use Intl with en-IN and Asia/Kolkata via @/kernel/datetime).

## THE TWELVE RULES

Violating any of these fails review, regardless of what the code delivers.

1.  Tenant and branch scope is applied in the repository layer ONLY.
    No raw prisma.* calls in routes, actions or components. Everything
    goes through db.scoped(ctx). Postgres RLS is a second wall, never the only one.
2.  Money is BigInt paise. Never Float, never Number for currency.
    Formatting happens at the render boundary and nowhere else.
3.  The stock ledger is append-only. Never UPDATE a balance column.
    Balances are derived and materialised inside the same transaction.
4.  Every mutation writes an audit row: actor, entity, action, before, after.
    No exceptions, including bulk operations.
5.  Every mutation emits a domain event. Follow-up rules, WhatsApp triggers,
    notifications and dashboards subscribe. Nothing hardcodes a side effect.
6.  Document numbers come from a Postgres sequence, allocated inside the
    transaction that writes the document. Gap-free, per branch, per FY, per type.
7.  GST arithmetic exists only in @/kernel/tax. Pure, table-driven, unit-tested.
    No GST maths anywhere else in the codebase.
8.  Permissions are checked server-side on every route. Hiding a button is
    presentation, not authorisation.
9.  Full schema up front. Migrations per stage. Never edit a shipped migration.
10. Nothing automated touches src/kernel/**. No subagent, no codemod.
    Kernel changes are written and reviewed by a human.
11. No file over 300 lines. No `any`. No console.log in committed code.
    No inline styles.
12. Every list screen is server-paginated. Loading 1,000 rows to the client
    is a defect, not a performance concern.

## Repository structure

src/
  kernel/          NEVER auto-modified
    db/            client.ts, scoped.ts, transaction.ts
    auth/          session.ts, context.ts
    rbac/          permissions.ts, guard.ts
    money/         paise.ts, format.ts
    tax/           gst.ts, hsn.ts, slabs.ts
    numbering/     series.ts
    documents/     render.ts, templates/
    approvals/     engine.ts
    events/        bus.ts, types.ts
    audit/         log.ts
    datetime/      index.ts
  modules/         one folder per business module
    <module>/      schema.ts queries.ts actions.ts permissions.ts
                   components/ __tests__/
  components/
    ui/            shadcn primitives
    data/          DataTable, EntityForm, MoneyInput, ...
    layout/        AppShell, Sidebar, Topbar, CommandPalette
    states/        EmptyState, ErrorState, LoadingState, PermissionDenied
  app/
    (auth)/login/
    (app)/         authenticated shell
    (mobile)/m/    field-first routes
    api/
  generators/      entity generator
prisma/            schema.prisma, migrations/, seed.ts
tests/e2e/         Playwright

## Design — "Sovereign"

Midnight indigo ground, antique gold used exactly ONCE per screen (the primary
action), plus one 1px gold hairline under the page title. That is the entire
gold budget. Two gold buttons on a screen means one is wrong.

Tokens live in src/app/globals.css under @theme. Never hardcode a colour.

  --color-ink          oklch(0.18 0.045 265)   ground
  --color-ink-raised   oklch(0.24 0.042 265)   cards, panels
  --color-ink-hover    oklch(0.28 0.045 265)   row hover
  --color-rule         oklch(0.36 0.038 265)   borders
  --color-gold         oklch(0.72 0.115 85)    THE accent
  --color-gold-lit     oklch(0.83 0.105 85)    hover, focus ring
  --color-paper        oklch(0.94 0.008 265)   primary text
  --color-paper-dim    oklch(0.68 0.028 265)   labels
  --color-signal       oklch(0.78 0.145 165)   in stock, paid, present
  --color-alarm        oklch(0.66 0.190 20)    overdue, short, absent
  --color-caution      oklch(0.78 0.130 75)    pending approval

Type: Fraunces (display — login, page titles, dashboard hero numbers ONLY) ·
Geist Sans (body, 13px base) · Geist Mono (EVERY numeral, tabular-nums) ·
Noto Sans Tamil.

Five UI rules:
1. Every numeral is Geist Mono with tabular-nums. Columns align on the decimal.
2. Indian format: ₹16,50,000. One formatter, formatINR(). toLocaleString('en-US') banned.
3. Density over comfort. 34px rows. A GRN screen shows 18 lines without scrolling.
4. Colour means status. Gold means "the action". Nothing is coloured for looks.
5. Keyboard first. / search · j/k rows · Enter open · n new · ⌘K palette · ⌘Enter submit.

Motion budget — allowed: 150ms hover/focus, 200ms sheets, skeleton shimmer,
400ms gold pulse on a saved row. Banned: page transitions, animated charts,
parallax, spring physics, any spinner over 300ms. All disabled under
prefers-reduced-motion.

## UX doctrine

- No full-page spinners. Streaming + skeletons matching the real layout.
- Optimistic by default. Undo toast for 8 seconds instead of a confirm dialog.
  Confirm ONLY for: cancelling a GST invoice, finalising payroll, posting a
  stock adjustment, deleting a user — and those require typing the document number.
- ⌘K command palette is the primary navigation. Build it early, not last.
- URL is state. Every filter, sort, page and tab is shareable.
- Never a modal that opens a modal. Row action → inline expand.
  Related record → 640px right sheet. New record → full page route.
- Errors name the next action. Never "Something went wrong."
- Offline is first-class. Attendance, site logs and photos queue in IndexedDB.

## India specifics

- GST: same state → CGST+SGST at half rate each; different state → IGST at full
  rate. Computed PER LINE. Round half-up per line; round-off once at document total.
- e-Invoice: mandatory above ₹5 crore AATO. B2B and exports only, B2C exempt.
  Cancellable ONLY within 24 hours — after that, credit note. Generate the IRN
  asynchronously; billing must work with the GSP down.
- e-Way bill above ₹50,000. Ship-to GSTIN mandatory.
- WhatsApp: per-message billing since Jul 2025. India rates — marketing ₹0.8631,
  utility ₹0.115, authentication ₹0.115. Replies inside the 24h service window
  are FREE. Store the category on every message; utility vs marketing is 7.5×.
- Payroll: PF, ESI, Tamil Nadu professional tax, TDS — all table-driven and
  effective-dated in StatutorySlab. Never hardcode a rate.
- Financial year April–March. IST everywhere. Mobile number is the user identity,
  not email.

## Commands

pnpm dev · pnpm typecheck · pnpm lint · pnpm test · pnpm test:e2e
pnpm db:migrate · pnpm db:seed · pnpm db:studio

## Definition of done

A task is done when ALL of these are true — not four of five:

- pnpm typecheck passes with zero errors
- pnpm lint passes with zero warnings
- unit tests written and passing for any business logic added
- an integration test covers the happy path and one failure path
- a permission test proves an unauthorised role gets 403, not a blank page
- verified in a browser at 1440px AND 390px
- empty, loading, error and permission-denied states all implemented
- keyboard-only operation confirmed
- no new TODO without a linked issue

## When you are stuck

If you cannot satisfy one of the Twelve Rules, STOP and tell me. Do not work
around it. Do not implement a partial version and note it in a comment.
Working around these rules is exactly how this class of project fails.

If the specification is ambiguous, ask ONE question rather than guessing.
A wrong guess in the kernel costs a week.

When you finish, run the verification gate and paste the actual output.
Do not claim completion without evidence.
