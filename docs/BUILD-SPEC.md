# Mandovara Business OS — Master Build Specification

**v1.0 · August 2026 · DigitalVetri.AI**
Companion to the Master Engagement Document v2.0. This file is the engineering contract.

---

## 0. Read this first

### 0.1 What this file is, and what it cannot be

You asked for a single file that produces a finished, production-grade application. Let me be straight with you about what is achievable, because the difference matters to your delivery date.

A 16-module ERP with ~119 screens, GST e-invoicing, payroll and multi-warehouse stock is roughly 60,000–90,000 lines of application code plus tests. No single prompt produces that in one run — not because the spec is weak, but because of context limits, because schema decisions must be verified against real data before 40 modules depend on them, and because you will change your mind about three things in week two.

What this file **is**: a complete, unambiguous specification that drives roughly **20 supervised Claude Code sessions** to a production result. Every session has a defined input, a defined output, and a verification gate that must pass before the next session starts. Section 16 contains the session prompts, ready to paste in order.

Used that way, this file gets you to production. Used as a single prompt, it gets you an impressive-looking shell with a broken stock ledger. Please use it the first way.

### 0.2 How to install this into your repo

```bash
mkdir -p docs .claude
# This file, split:
#   CLAUDE.md          <- Sections 1, 2, 3, 4 only. Short. Always in context.
#   docs/design.md     <- Sections 5, 6, 7
#   docs/architecture.md <- Sections 8, 9, 10
#   docs/modules.md    <- Section 11
#   docs/quality.md    <- Sections 12, 13, 14, 15
#   docs/plan.md       <- Sections 16, 17
```

`CLAUDE.md` must stay under ~400 lines. It is read on every turn; bloating it degrades every response. The rest is read on demand — reference it explicitly in each session prompt.

### 0.3 The one thing that determines whether this succeeds

**Build the kernel and the Product Catalog module by hand, properly, before generating anything else.** Sessions 1–8. If the kernel is right, modules 2–16 are mechanical. If it is wrong, every module inherits the defect and you are rewriting in month three.

Resist the urge to demo something impressive in week one. The impressive thing in week one is a correct permission layer that nobody can see.

---

## 1. Product definition

### 1.1 What we are building

A single business operating system for Mandovara — a Tamil Nadu trading and project-execution company carrying 1,000+ product SKUs — replacing Excel sheets, WhatsApp groups, paper registers and tribal knowledge with one database.

### 1.2 Who uses it

This matters more than any technical decision in this document. Design and build for these five people:

| User | Context | What they need |
|---|---|---|
| **Storekeeper** | Godown, poor signal, cheap Android, entering 40 GRN lines | Speed, density, offline tolerance, big tap targets |
| **Accounts clerk** | Desk, reconciling 200 invoices a month | Keyboard everything, no mouse, no animation, correct numbers |
| **Sales executive** | On the road, phone, in front of a customer | Instant catalog search, quote in 5 minutes, one-tap WhatsApp |
| **Site engineer** | Project site, no signal, dusty phone | Offline queue, photo upload, one-tap attendance |
| **Rohit Vaid (MD)** | 10 minutes each morning, on a phone | One screen, correct numbers, no compilation delay |

The first four use it 200 times a day. **Every animation is a tax they pay 200 times.** The fifth needs it to feel like a serious instrument — achieved through precision, not decoration.

### 1.3 Success criteria (from the engagement document)

- Every enquiry recorded and owned within one hour.
- Any quotation produced from the catalog in under five minutes, correct rate, correct GST.
- System stock matches a surprise physical count within agreed tolerance.
- Owner sees outstanding, ageing and today's collection on a phone without asking anyone.
- Payroll for the whole company completed in under two hours.
- No customer told "I will check and call you back" for data that already exists.

### 1.4 Scale targets

| Dimension | Launch | Design for |
|---|---|---|
| Products (SKUs) | 1,200 | 25,000 |
| Clients | 800 | 15,000 |
| Users | 25 | 200 |
| Branches / warehouses | 2 | 20 |
| Invoices / month | 400 | 10,000 |
| Stock ledger rows / year | 60,000 | 2,000,000 |

---

## 2. Non-negotiable engineering rules

**These go in `CLAUDE.md` verbatim. They are not suggestions. A pull request that violates any of them is rejected regardless of what it delivers.**

### 2.1 The twelve rules

1. **Tenant and branch scope is applied in the repository layer only.** No raw `prisma.*` calls in route handlers, server actions or components. Everything goes through `db.scoped(ctx)`. Postgres RLS is a second wall, never the only one.
2. **Money is `BigInt` paise. Never `Float`, never `Number` for currency.** Formatting happens at the render boundary and nowhere else.
3. **The stock ledger is append-only.** No `UPDATE` on a balance column, ever. Balances are derived and materialised from ledger rows inside the same transaction that writes them.
4. **Every mutation writes an audit row** with actor, entity, action, before-value and after-value. No exceptions, including bulk operations.
5. **Every mutation emits a domain event.** Follow-up rules, WhatsApp triggers, notifications and dashboards subscribe. Nothing hardcodes a side effect.
6. **Document numbers come from a database sequence**, allocated inside the transaction that writes the document. Gap-free, per branch, per financial year, per document type.
7. **GST is computed by pure functions in `@/kernel/tax`**, table-driven, with unit tests. No GST arithmetic anywhere else in the codebase.
8. **Permissions are checked server-side on every route.** Hiding a button is presentation, not authorisation.
9. **Full schema up front; migrations per stage; never edit a shipped migration.**
10. **No subagent, codemod or automated refactor touches `src/kernel/**`.** Kernel changes are written and reviewed by a human.
11. **No component file exceeds 300 lines. No `any`. No `console.log` in committed code. No inline styles.**
12. **Every list screen is server-paginated.** Loading 1,000 rows to the client is a defect, not a performance issue.

### 2.2 Definition of "done" for any task

A task is done when **all** of these are true. Not four of five.

- [ ] Types check (`pnpm typecheck`) with zero errors
- [ ] Lint passes (`pnpm lint`) with zero warnings
- [ ] Unit tests written and passing for any business logic added
- [ ] An integration test covers the happy path and one failure path
- [ ] Permission test proves an unauthorised role gets 403, not a blank page
- [ ] Verified in a browser at 1440px **and** 390px
- [ ] Empty, loading, error and permission-denied states all implemented
- [ ] Keyboard-only operation confirmed
- [ ] No new `TODO` without a linked issue

### 2.3 Instructions to the agent

> When you cannot satisfy a rule in Section 2.1, **stop and say so**. Do not work around it. Do not implement a partial version and note it in a comment. The rules exist because working around them is exactly how this class of project fails.
>
> When the specification is ambiguous, **ask one question** rather than guessing. A wrong guess in the kernel costs a week.
>
> When you finish a session, **run the verification gate for that session** and paste the output. Do not claim completion without evidence.

---

## 3. Technology stack

Versions verified against current releases as of **August 2026**. Pin exact versions in `package.json`; do not use `^` for the framework or ORM.

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | **16.2.x** | 16.x is current stable. Next.js 15 reaches end of support Oct 2026 — do not start on it. Turbopack is default. |
| Runtime | React | **19.2.x** | Server Components, `useOptimistic`, `useActionState` |
| Language | TypeScript | 5.9+ | `strict: true`, `noUncheckedIndexedAccess: true` |
| Styling | Tailwind CSS | **v4** | **CSS-first.** No `tailwind.config.js`. Theme via `@theme` in `globals.css`. Colours in OKLCH. |
| Components | shadcn/ui | latest | `new-york` style. No `forwardRef`, `data-slot` attributes, `sonner` for toasts (the `toast` component is deprecated). |
| Database | PostgreSQL | 16+ | Supabase or Neon, **India region (ap-south-1)** |
| ORM | Prisma | 6.x | `previewFeatures = ["relationJoins"]` |
| Validation | Zod | 4.x | One schema per entity, shared client and server |
| Auth | Lucia-style sessions or Clerk | — | Mobile-number-first login. Indian SMEs do not use email as identity. |
| Jobs / queue | BullMQ + Redis | — | Reminders, imports, exports, IRN retries |
| Automation | n8n | self-hosted | Business rules the client can change without a deploy |
| Messaging | WhatsApp Cloud API | Graph v21+ | Official Meta. Per-message billing (see §10.4) |
| File storage | Supabase Storage / S3 | — | Signed URLs, never public buckets |
| PDF | React-PDF or Playwright | — | Server-side. One renderer, many templates. |
| Excel | SheetJS (xlsx) | — | Import and export |
| Tables | TanStack Table v8 | — | Headless. The `<DataTable>` wraps it. |
| Forms | react-hook-form + Zod | — | |
| Charts | Recharts | — | Sparingly. Most "charts" here are `<AgeingBars>`, plain divs. |
| Testing | Vitest + Playwright | — | Unit + E2E |
| Package manager | pnpm | — | |

### 3.1 Deliberately excluded

- **No state management library.** Server Components plus URL state plus `useOptimistic` covers this app. Adding Zustand or Redux here is a symptom of misusing RSC.
- **No GraphQL.** Server Actions and typed route handlers are simpler and faster to build.
- **No component library beyond shadcn/ui.** MUI or Ant would fight the design system.
- **No `moment`, no `date-fns` for formatting.** Use `Intl` with `en-IN` and `Asia/Kolkata`, wrapped in `@/kernel/datetime`.

---

## 4. Repository structure

```
src/
  kernel/                    # NEVER auto-modified. Human review only.
    db/
      client.ts              # Prisma singleton
      scoped.ts              # db.scoped(ctx) — the ONLY way to query
      transaction.ts         # withTransaction helper
    auth/
      session.ts, context.ts # RequestContext { userId, orgId, branchId, roles }
    rbac/
      permissions.ts         # module.action registry (single source of truth)
      guard.ts               # requirePermission(ctx, 'invoice.create')
    money/
      paise.ts               # BigInt arithmetic
      format.ts              # formatINR — the ONLY currency formatter
    tax/
      gst.ts                 # pure GST functions
      hsn.ts, slabs.ts       # table-driven rates
    numbering/
      series.ts              # gap-free document numbers
    documents/
      render.ts, templates/  # one renderer, many templates
    approvals/
      engine.ts              # entity + threshold + chain + state
    events/
      bus.ts, types.ts       # domain events
    audit/
      log.ts                 # every mutation
    datetime/
      index.ts               # IST, en-IN, financial year helpers

  modules/                   # One folder per business module
    catalog/
      schema.ts              # Zod
      queries.ts             # read
      actions.ts             # write (server actions)
      permissions.ts
      components/
      __tests__/
    leads/ clients/ quotations/ ...

  components/
    ui/                      # shadcn primitives
    data/                    # DataTable, EntityForm, MoneyInput, ...
    layout/                  # AppShell, Sidebar, Topbar, CommandPalette
    states/                  # EmptyState, ErrorState, LoadingState

  app/
    (auth)/login/
    (app)/                   # authenticated shell
      dashboard/ products/ leads/ ... settings/
    (mobile)/m/              # field-first routes
    api/

  generators/                # entity generator (built in Session 8)
    templates/
    generate.ts

prisma/
  schema.prisma
  migrations/
  seed.ts

docs/                        # this specification, split
tests/
  e2e/                       # Playwright
```

---

## 5. Design system — "Sovereign"

### 5.1 The direction

You asked for royal. Royal done badly is gradients and gold everywhere and a product that takes 400ms to render a table. Royal done well is what a Patek Philippe movement or a Reserve Bank banknote does: **deep saturated ground, one precious metal used sparingly, obsessive precision in the small details, and nothing decorative that does not also do a job.**

The reference points are Indian and specific: engraved share certificates, Chettinad brass, stamp paper guilloche, the gold leaf of Tanjore painting, the machined feel of a brass theodolite. Not Silicon Valley SaaS.

**The thesis: precision is the luxury.** A column of ₹ figures that align perfectly on the decimal, in a monospace face, on a deep indigo field, with a single hairline of gold above them — that reads as more expensive than any gradient.

### 5.2 Colour

Tailwind v4 is CSS-first. This goes in `src/app/globals.css`.

```css
@import "tailwindcss";

@theme {
  /* ── Ground ─────────────────────────────────────────────── */
  --color-ink:          oklch(0.18 0.045 265);  /* #0B1020  midnight indigo */
  --color-ink-raised:   oklch(0.24 0.042 265);  /* #131A2E  cards, panels   */
  --color-ink-hover:    oklch(0.28 0.045 265);  /* #1A2340  row hover       */
  --color-ink-sunken:   oklch(0.14 0.040 265);  /* #070B16  wells, inputs   */
  --color-rule:         oklch(0.36 0.038 265);  /* #26314F  borders         */

  /* ── The precious metal. One element per screen. ────────── */
  --color-gold:         oklch(0.72 0.115 85);   /* #C9A227  antique gold    */
  --color-gold-lit:     oklch(0.83 0.105 85);   /* #E5C55C  hover / focus   */
  --color-gold-dim:     oklch(0.55 0.090 85);   /* #8A6F1B  disabled        */

  /* ── Text ───────────────────────────────────────────────── */
  --color-paper:        oklch(0.94 0.008 265);  /* #EDEFF5  primary         */
  --color-paper-dim:    oklch(0.68 0.028 265);  /* #8792AC  labels          */
  --color-paper-faint:  oklch(0.50 0.030 265);  /* #5A6785  disabled        */

  /* ── Status. Meaning only. Never decoration. ────────────── */
  --color-signal:       oklch(0.78 0.145 165);  /* #35D0A5  in stock, paid  */
  --color-alarm:        oklch(0.66 0.190 20);   /* #FF5D6C  overdue, short  */
  --color-caution:      oklch(0.78 0.130 75);   /* #E5A83C  pending         */
  --color-neutral:      oklch(0.68 0.028 265);  /* draft, cancelled         */

  /* ── Type ───────────────────────────────────────────────── */
  --font-display: "Fraunces", Georgia, serif;
  --font-body:    "Geist Sans", system-ui, sans-serif;
  --font-data:    "Geist Mono", "SF Mono", monospace;
  --font-tamil:   "Noto Sans Tamil", sans-serif;

  /* ── Radius ─────────────────────────────────────────────── */
  --radius-sm: 3px;   /* inputs, buttons  */
  --radius-md: 5px;   /* cards, panels    */
  --radius-lg: 8px;   /* modals           */
}
```

**Discipline on gold.** One gold element per screen — the primary action. The gold hairline under the page title is the second and only other permitted use. If a screen has two gold buttons, one of them is wrong.

**Discipline on status colour.** `--signal`, `--alarm`, `--caution` mean exactly one thing each. A green button because green looks nice is a defect.

### 5.3 Typography

| Role | Face | Weight | Where |
|---|---|---|---|
| Display | **Fraunces** | 600, `opsz` 96, `SOFT` 0 | Login wordmark, page titles, dashboard hero numbers. Nowhere else. |
| Body | **Geist Sans** | 400 / 500 / 600 | All prose, labels, buttons, nav, form fields |
| Data | **Geist Mono** | 400 / 500 | **Every numeral in the product.** ₹, qty, SKU code, HSN, GST%, dates, document numbers |
| Tamil | **Noto Sans Tamil** | 400 / 600 | Bilingual labels, WhatsApp template previews |

A high-contrast serif on a dense dark application is unusual, and that is the point — it is the one gesture that makes this feel commissioned rather than templated. It is confined to moments where nobody is doing data entry.

```css
.tabular { font-family: var(--font-data); font-variant-numeric: tabular-nums; }
```

Apply `.tabular` to **every** cell containing a number. Non-negotiable — it is what makes columns align, and alignment is what makes the product feel precise.

**Scale:** 11 / 12 / **13** / 14 / 16 / 20 / 24 / 32 / 48 / 64.
Body default is 13px. This is a dense business application. A 16px base is a marketing site default and wastes a third of every screen.

### 5.4 Spacing, density, elevation

- **Spacing:** 4px base. Use 4 / 8 / 12 / 16 / 24 / 32 / 48 only.
- **Table rows:** 30px compact · **34px default** · 42px comfortable. Persist the user's choice.
- **Elevation:** no drop shadows on the dark ground — they read as smudge. Depth comes from `--color-ink-raised` plus a 1px `--color-rule` border. Modals: backdrop `oklch(0.18 0.045 265 / 0.76)` with 10px blur.
- **The gold hairline:** 1px, `--color-gold` at 55% opacity, directly under the page title, full content width. This is the signature. It appears once per screen and never anywhere else.

### 5.5 The engraving (use once, or not at all)

A guilloche pattern — the fine interlocking line-work on a banknote or share certificate — as an SVG at **3% opacity**, on the login screen background and large empty states only. Never behind data. Never on a screen someone uses daily.

If in doubt, leave it out. Restraint is the whole strategy.

### 5.6 The five rules that define the product UI

1. **Every numeral is `--font-data` with `tabular-nums`.** Columns align on the decimal.
2. **Indian number format throughout.** `₹16,50,000`. One formatter, `formatINR()`. `toLocaleString('en-US')` is banned in review.
3. **Density over comfort.** 34px rows. A GRN screen shows 18 lines without scrolling.
4. **Colour means status.** Gold means "the action". Nothing is coloured for looks.
5. **Keyboard first.** `/` search · `j`/`k` rows · `Enter` open · `n` new · `⌘K` palette · `⌘Enter` submit · `Esc` close.

---

## 6. UX doctrine

What "best-in-era UX" actually means for a business application in 2026. These are behavioural requirements, not aspirations — each one is testable.

### 6.1 Speed is the feature

| Interaction | Budget | How |
|---|---|---|
| Keystroke → search results | **< 120ms** | Server-side FTS, debounce 80ms, `useDeferredValue` |
| Click row → detail visible | **< 200ms** | RSC streaming, prefetch on hover |
| Save → row updates | **0ms perceived** | `useOptimistic`, roll back on failure |
| Page → interactive | **< 1.5s** on mid-range Android / 4G | RSC, no client-side data fetching on first paint |

**There are no full-page spinners in this product.** Streaming plus skeletons matching the real layout, always.

### 6.2 Optimistic by default, undo instead of confirm

Confirm dialogs are a tax on the 99% of actions that were intended. Apply the action immediately, show a toast with **Undo** for 8 seconds, reverse it if pressed.

Confirm dialogs are reserved for the genuinely irreversible: cancelling a GST invoice, finalising a payroll run, posting a stock adjustment, deleting a user. In those cases the dialog names exactly what will happen and requires typing the document number.

### 6.3 The command palette is the primary navigation

`⌘K` / `Ctrl+K`. Fuzzy search across navigation, clients, products by code or name, invoice numbers, quotation numbers, and verbs (`new quotation`, `new GRN`, `record receipt`). Recents pinned. Results grouped by type.

Experienced users will navigate almost entirely this way after week two. Build it in Session 5, not as a nice-to-have at the end.

### 6.4 URL is state

Every filter, sort, page, tab and search term lives in the URL. A user can bookmark "my overdue quotations", send it on WhatsApp to a colleague, and it opens identically for them (subject to their permissions). No hidden client state that cannot be shared.

### 6.5 Saved views

Named filter + column + sort combinations, personal or shared with a role. "Below reorder", "Overdue 60+", "My open quotes". This is how a real user makes a 1,000-row list usable, and it costs one table plus one dropdown.

### 6.6 Progressive disclosure, never modal stacking

- Row action → inline expand
- Related record → right-hand sheet (640px)
- New record → full page route
- **Never** a modal that opens a modal. If you need two levels, the first should have been a page.

### 6.7 Errors are directions, not apologies

| Bad | Good |
|---|---|
| "Something went wrong" | "Could not save invoice. Number MDV/26-27/0412 is already used. Refresh to get the next number." |
| "Invalid input" | "GSTIN must be 15 characters. You entered 14." |
| "Access denied" | "You do not have access to Payroll. Ask Rohit Vaid to grant Payroll: View." |
| "No data" | "No quotations yet. Quotations you create from a lead will appear here. → Create quotation" |

Errors never apologise, never blame the user, and always name the next action.

### 6.8 Offline is a first-class state

Field roles work in godowns and at sites with no signal. Attendance punches, site logs and photos queue in IndexedDB and sync when connectivity returns. A persistent banner shows "Working offline — 3 entries queued." Queued rows carry a mono clock badge.

This is not a nice-to-have. A site engineer who loses a day of attendance data stops using the system.

### 6.9 Bilingual without being clumsy

Tamil is available for: navigation labels, status values, WhatsApp templates, payslips, and all validation messages. Data — product names, client names — stays as entered. Language is a user preference, switchable in one click, persisted server-side.

### 6.10 AI, used narrowly

Two places only, both earning their keep:

1. **Natural-language filter.** "show me quotes above 2 lakh pending more than a week" → parsed into the same filter state the UI produces. Falls back to the normal filter panel, always visible.
2. **WhatsApp first response.** Price, stock and catalogue enquiries answered in Tamil or English, with clean handover to a human on anything else.

No AI-generated summaries of financial data. No chatbot bolted onto the dashboard. If the number needs explaining, the report is wrong.

### 6.11 Accessibility floor

WCAG AA contrast for all text on `--color-ink` (verify `--color-paper-dim` at 11px; raise it if it fails). Visible focus ring in `--color-gold-lit`, 2px offset. Real `<label>` on every field — placeholder is not a label. `prefers-reduced-motion: reduce` disables every transition. Full keyboard operation for every flow including the quotation builder.

### 6.12 Motion budget

| Allowed | Banned |
|---|---|
| 150ms opacity/transform on hover and focus | Page transition animations |
| 200ms slide for sheets and drawers | Animated charts on every render |
| Skeleton shimmer while streaming | Parallax, scroll-triggered reveals |
| 400ms gold pulse on a just-saved row | Spring physics on daily-use controls |
| Optimistic state change | Any spinner shown longer than 300ms |

---

## 7. Component contracts

Eleven components. Built once, in Sessions 4–5, before any module. They are roughly 60% of the application by line count and by risk.

### 7.1 `<DataTable>` — over-invest here

```ts
interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  fetcher: (q: TableQuery) => Promise<{ rows: T[]; total: number }>
  rowHref?: (row: T) => string
  bulkActions?: BulkAction<T>[]
  savedViewsKey?: string        // enables saved views for this table
  density?: 'compact' | 'default' | 'comfortable'
  emptyState: ReactNode
}
```

| Capability | Requirement |
|---|---|
| Pagination | Server-side. Cursor-based above 10,000 rows. |
| Sorting / filtering | Server-side, reflected in the URL |
| Header | Sticky. Resizable columns, widths persisted per user per table. |
| Selection | Checkbox column, shift-click range, **select-all-matching-filter** (not just the visible page) |
| Bulk actions | Bar slides over the header when rows are selected; shows the true matched count |
| Inline edit | Double-click a permitted cell. `Tab` commits and advances, `Esc` reverts, optimistic. |
| Saved views | Named filter+column+sort sets, personal or role-shared |
| Density | Three levels, persisted |
| Export | Current view to Excel and PDF, respecting filters and column order, via a background job above 5,000 rows |
| Keyboard | `j`/`k` move · `Enter` open · `x` select · `/` focus search · `⌘A` select all |
| Virtualisation | Above 100 visible rows |
| Numerals | Any numeric column automatically gets `.tabular` and right alignment |

### 7.2 `<EntityForm>`

Schema-driven from Zod. Auto-generates fields from the schema and a field-config map. Handles: validation display, dirty-state navigation guard, autosave draft to IndexedDB, `⌘Enter` submit, server-side error mapping back onto fields.

Field types: `text · number · money · quantity · date · select · asyncSelect · multiselect · textarea · file · toggle · specGroup` (renders a product category's JSONB spec fields).

### 7.3 `<MoneyInput>` / `<MoneyDisplay>`

`BigInt` paise internally. Accepts `1650000`, `16,50,000`, `16.5L`, `16.5 lakh` and normalises. Displays `₹16,50,000`. Negative in `--color-alarm` and parentheses. **No other component in the codebase formats currency.** Enforce with a lint rule.

### 7.4 `<QuantityInput>`

Number plus UOM suffix. Honours the product's decimal precision (2 for kg, 0 for nos). Shows available stock inline and warns — without blocking — when the entry exceeds it.

### 7.5 `<StatusPill>`

11px, mono, small caps, 2px radius. Maps status string → colour through **one** central map so "Overdue" is the same red on every screen in the product.

### 7.6 `<Timeline>`

The activity log on every record detail page. Grouped by day. Each entry: actor, action, `old → new` where relevant, timestamp. Filter chips: All / Notes / Calls / WhatsApp / Changes / Documents. Reads from the audit log and the event stream.

### 7.7 `<DocumentPreview>`

PDF in a 640px right sheet. Actions: Download · Print · **Send on WhatsApp** · Email. The WhatsApp action is one tap and will be the most-used control in the product.

### 7.8 `<ApprovalBar>`

Sticky at the top of any record in an approval state. Names what is being approved, the threshold that triggered it, who must approve. Approve / Reject with mandatory reason on reject.

### 7.9 `<AgeingBars>`

Stacked horizontal bar, 0-30 / 31-60 / 61-90 / 90+, coloured signal → caution → alarm → alarm-dark. Plain divs, no chart library. Clicking a segment filters the underlying list.

### 7.10 `<SearchCombobox>`

Async picker for product / client / vendor, used inside every line-item builder. Searches code, name and brand. Renders code in mono, name, and a right-aligned stock or rate figure. Fully keyboard operable — this is how a quotation gets built in five minutes.

### 7.11 `<AttachmentGrid>`

Drag-drop upload, image thumbnails, type icons for documents, inline rename, delete with undo, per-file "Send on WhatsApp". Client-side image compression before upload.

### 7.12 Screen states

`<EmptyState>` · `<ErrorState>` · `<LoadingState>` · `<PermissionDenied>` · `<OfflineBanner>`. Copy rules in §6.7. Every list and detail screen must render all applicable states — this is checked in the definition of done.

---

## 8. Architecture — the kernel

### 8.1 The central decision

This is **one kernel plus 16 thin slices**, not 16 modules. Get the kernel right and each module reduces to a schema, some forms and a few domain rules. Get it wrong and every module re-implements scoping, permissions, money and audit — badly, and differently each time.

### 8.2 The seven kernel components

**1 · Tenant and branch scoping**

```ts
// src/kernel/db/scoped.ts — the ONLY database entry point
export function scoped(ctx: RequestContext) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (TENANT_SCOPED.has(model)) {
            args.where = { ...args.where, orgId: ctx.orgId }
            if (BRANCH_SCOPED.has(model) && ctx.branchScope !== 'ALL') {
              args.where.branchId = { in: ctx.branchIds }
            }
          }
          return query(args)
        },
      },
    },
  })
}
```
Postgres RLS is enabled as a second wall. **Never the only one.** A previous build leaked across tenants in five places because scoping was applied per-query.

**2 · RBAC**

Permissions are `module.action` strings in a table, not an enum in code — the client edits the matrix at runtime. `requirePermission(ctx, 'invoice.create')` throws `ForbiddenError` and is called at the top of every server action and route handler. Field-level guards for cost price, margin and salary.

**3 · Money**

```ts
export type Paise = bigint
export const rupees = (n: number): Paise => BigInt(Math.round(n * 100))
export const formatINR = (p: Paise): string => /* ₹16,50,000 — the ONLY formatter */
```
Prisma columns are `BigInt`. No `Decimal`, no `Float`. Rounding happens once, at the document total, using round-half-up as GST rules require.

**4 · Numbering**

```sql
CREATE SEQUENCE doc_seq_invoice_br1_fy2627 START 1;
```
One sequence per document type × branch × financial year, created on demand. Allocated with `nextval()` **inside** the transaction that writes the document. Gap-free under concurrency. Format is configurable: `MDV/26-27/0412`.

**5 · Document engine**

One renderer, many templates: quotation, proforma, invoice, credit note, delivery challan, purchase order, payslip, receipt. Templates are data-driven from company settings (logo, letterhead, GSTIN, terms, bank details). Rendered server-side so output is byte-identical everywhere.

**6 · Approval engine**

Generic: `entity + threshold + approverChain + state`. Discount approval, PO approval, expense approval and credit-limit override are the same mechanism with different configuration. Building four separate ones is four times the bugs.

**7 · Event bus and audit**

```ts
type DomainEvent =
  | { type: 'quotation.sent'; quotationId: string; clientId: string }
  | { type: 'invoice.created'; invoiceId: string; amount: Paise }
  | { type: 'stock.belowReorder'; productId: string; warehouseId: string }
  | { type: 'payment.overdue'; invoiceId: string; daysOverdue: number }
  // ...
```
Every mutation emits. Follow-up rules, WhatsApp triggers, notifications, dashboard invalidation and the audit log all subscribe. **This is what makes the "configurable rule engine" real rather than a marketing claim.**

### 8.3 Where the time actually goes

| Hard part | The trap | Do this |
|---|---|---|
| Stock ledger | Mutating a balance column | Append-only rows; balance derived and materialised; `SELECT … FOR UPDATE` on the balance row inside the transaction |
| Product specs, 1,000+ SKUs | EAV tables | JSONB + per-category schema definition + GIN index |
| Catalog search | `LIKE '%term%'` | Materialised `tsvector` column updated by trigger, plus `pg_trgm` GIN index on `code` |
| GST / e-Invoice | Building IRP integration directly | Go through a GSP. Budget two weeks for sandbox onboarding alone. |
| Payroll | Hardcoding PF/ESI/PT slabs | Table-driven, effective-dated |
| Field connectivity | Assuming online | PWA + IndexedDB outbox queue |
| Invoice numbering | `MAX(number) + 1` | Database sequence inside the transaction |
| Receipt allocation | Subtracting from a balance | Explicit allocation rows: receipt → invoice → amount |

---

## 9. Data model

~70 models. Design the whole schema in Session 3; ship migrations per stage. **Adding `orgId` or audit columns in month three is how this class of project dies.**

### 9.1 Conventions

- Every model: `id String @id @default(cuid())`, `createdAt`, `updatedAt`, `createdById`, `updatedById`
- Every tenant-scoped model: `orgId String` + `@@index([orgId])`
- Every branch-scoped model: `branchId String`
- Money: `BigInt` (paise). Quantity: `Decimal @db.Decimal(18,4)`
- Soft delete via `status` enum, never a `deleted` boolean, never a hard delete on transactional data
- All timestamps UTC in the database; rendered in IST

### 9.2 Kernel

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  gstin     String?
  pan       String?
  fyStartMonth Int   @default(4)          // April
  settings  Json
  branches  Branch[]
  users     User[]
}

model Branch {
  id             String @id @default(cuid())
  orgId          String
  name           String
  gstin          String
  stateCode      String                    // place-of-supply logic
  address        Json
  invoicePrefix  String
  @@index([orgId])
}

model User {
  id           String @id @default(cuid())
  orgId        String
  mobile       String                      // PRIMARY identity, not email
  email        String?
  name         String
  passwordHash String?
  status       UserStatus @default(ACTIVE)
  locale       String @default("en")       // "en" | "ta"
  roles        UserRole[]
  branchIds    String[]
  @@unique([orgId, mobile])
}

model Role {
  id          String @id @default(cuid())
  orgId       String
  name        String                       // Owner, Manager, Sales Exec, Store, Accounts, HR, Site Eng
  permissions RolePermission[]
}

model RolePermission {
  id     String @id @default(cuid())
  roleId String
  key    String                            // "invoice.create", "product.viewCost"
  scope  PermissionScope @default(FULL)    // NONE | VIEW | OWN | FULL
  @@unique([roleId, key])
}

model NumberingSeries {
  id           String @id @default(cuid())
  orgId        String
  branchId     String
  docType      String                      // INVOICE, QUOTATION, GRN, PO, CHALLAN
  financialYear String                     // "26-27"
  prefix       String
  sequenceName String                      // Postgres sequence
  @@unique([orgId, branchId, docType, financialYear])
}

model AuditLog {
  id         String @id @default(cuid())
  orgId      String
  actorId    String
  entityType String
  entityId   String
  action     String                        // CREATE | UPDATE | DELETE | APPROVE | CANCEL
  before     Json?
  after      Json?
  ip         String?
  createdAt  DateTime @default(now())
  @@index([orgId, entityType, entityId])
  @@index([orgId, createdAt])
}

model Approval {
  id         String @id @default(cuid())
  orgId      String
  entityType String
  entityId   String
  reason     String                        // "discount 18% exceeds 12% floor"
  state      ApprovalState @default(PENDING)
  approverId String?
  decidedAt  DateTime?
  note       String?
  @@index([orgId, state])
}
```

### 9.3 Catalog

```prisma
model Category {
  id       String @id @default(cuid())
  orgId    String
  parentId String?                         // 3 levels: Category > Sub > Brand-group
  name     String
  specTemplate SpecTemplate?
  sortOrder Int @default(0)
}

model SpecTemplate {
  id         String @id @default(cuid())
  categoryId String @unique
  fields     Json    // [{key,label,type,unit,required,filterable,options[]}]
}

model Product {
  id            String @id @default(cuid())
  orgId         String
  code          String
  name          String
  categoryId    String
  brandId       String?
  hsn           String
  uom           String
  uomPrecision  Int    @default(0)
  gstRate       Decimal @db.Decimal(5,2)
  specs         Json                        // validated against SpecTemplate
  parentId      String?                     // variants
  variantAxes   Json?                       // {size:"32mm", grade:"ISI"}
  reorderLevel  Decimal? @db.Decimal(18,4)
  minStock      Decimal? @db.Decimal(18,4)
  trackBatch    Boolean @default(false)
  trackSerial   Boolean @default(false)
  status        ProductStatus @default(ACTIVE)
  searchVector  Unsupported("tsvector")?    // trigger-maintained
  prices        ProductPrice[]
  documents     ProductDocument[]
  @@unique([orgId, code])
  @@index([orgId, categoryId])
  // Raw SQL migration adds:
  //   GIN index on searchVector
  //   GIN pg_trgm index on code
  //   GIN index on specs
}

model ProductPrice {
  id        String @id @default(cuid())
  productId String
  tier      PriceTier                       // COST | MRP | DEALER | DISTRIBUTOR | PROJECT
  clientId  String?                         // client-specific override
  amount    BigInt
  effectiveFrom DateTime
  effectiveTo   DateTime?
  @@index([productId, tier, effectiveFrom])
}

model ProductDocument {
  id        String @id @default(cuid())
  productId String
  type      DocType   // DATASHEET | BROCHURE | WARRANTY | TEST_CERT | ISI_BIS | MANUAL | IMAGE
  fileKey   String
  fileName  String
  sizeBytes Int
}
```

### 9.4 Inventory — the append-only ledger

```prisma
model Warehouse {
  id       String @id @default(cuid())
  orgId    String
  branchId String
  name     String
  racks    Rack[]
}
model Rack { id String @id @default(cuid())  warehouseId String  code String  bins Bin[] }
model Bin  { id String @id @default(cuid())  rackId String  code String }

model StockLedgerEntry {
  id           String @id @default(cuid())
  orgId        String
  warehouseId  String
  productId    String
  batchId      String?
  binId        String?
  direction    LedgerDirection               // IN | OUT
  quantity     Decimal @db.Decimal(18,4)     // always positive
  rate         BigInt                        // valuation rate at movement
  refType      String                        // GRN | DISPATCH | TRANSFER | ADJUSTMENT | PROJECT_ISSUE | RETURN
  refId        String
  occurredAt   DateTime
  createdAt    DateTime @default(now())
  @@index([orgId, productId, warehouseId, occurredAt])
  @@index([orgId, refType, refId])
  // APPEND ONLY. No UPDATE. No DELETE. Reversals are new rows in the opposite direction.
}

model StockBalance {
  id          String @id @default(cuid())
  orgId       String
  warehouseId String
  productId   String
  quantity    Decimal @db.Decimal(18,4)
  value       BigInt
  reserved    Decimal @db.Decimal(18,4) @default(0)
  updatedAt   DateTime @updatedAt
  @@unique([warehouseId, productId])
  // Materialised from the ledger. Written ONLY by the ledger service,
  // ONLY inside the same transaction, ONLY after SELECT ... FOR UPDATE.
}
```

### 9.5 Sales and finance

```prisma
model Quotation {
  id          String @id @default(cuid())
  orgId       String
  branchId    String
  number      String
  revision    Int    @default(0)
  parentId    String?                       // revision chain
  clientId    String
  date        DateTime
  validUntil  DateTime
  status      QuotationStatus
  lines       QuotationLine[]
  taxableAmount BigInt
  cgst BigInt
  sgst BigInt
  igst BigInt
  roundOff BigInt
  total    BigInt
  ownerId  String
  @@unique([orgId, branchId, number, revision])
}

model QuotationLine {
  id          String @id @default(cuid())
  quotationId String
  lineNo      Int
  productId   String
  description String
  quantity    Decimal @db.Decimal(18,4)
  rate        BigInt
  discountPct Decimal @db.Decimal(5,2) @default(0)
  taxable     BigInt
  gstRate     Decimal @db.Decimal(5,2)
  cgst BigInt
  sgst BigInt
  igst BigInt
  amount BigInt
  isOptional Boolean @default(false)
}

model Invoice {
  id             String @id @default(cuid())
  orgId          String
  branchId       String
  number         String                     // gap-free, from sequence
  type           InvoiceType                // TAX | PROFORMA | CREDIT_NOTE | DEBIT_NOTE
  clientId       String
  orderId        String?
  milestoneId    String?
  date           DateTime
  dueDate        DateTime
  placeOfSupply  String                     // state code — drives CGST/SGST vs IGST
  lines          InvoiceLine[]
  taxableAmount  BigInt
  cgst BigInt
  sgst BigInt
  igst BigInt
  roundOff BigInt
  total    BigInt
  advanceAdjusted BigInt @default(0)
  // e-Invoice
  irn            String?
  ackNo          String?
  ackDate        DateTime?
  qrCode         String?
  irnStatus      IrnStatus @default(NOT_REQUIRED)
  irnError       String?
  ewbNumber      String?
  ewbValidUntil  DateTime?
  status         InvoiceStatus
  cancelledAt    DateTime?
  cancelReason   String?
  @@unique([orgId, branchId, number])
  @@index([orgId, clientId, status])
}

model Receipt {
  id          String @id @default(cuid())
  orgId       String
  number      String
  clientId    String
  date        DateTime
  mode        PaymentMode                   // CASH | UPI | NEFT | RTGS | CHEQUE | CARD
  reference   String?
  chequeStatus ChequeStatus?
  amount      BigInt
  allocations ReceiptAllocation[]
  unallocated BigInt @default(0)            // "on account"
}

model ReceiptAllocation {
  id        String @id @default(cuid())
  receiptId String
  invoiceId String
  amount    BigInt
  // Explicit rows. NEVER subtract from an invoice balance column.
}
```

### 9.6 Remaining groups (same conventions)

| Group | Models |
|---|---|
| **Customer** | Lead · LeadActivity · Client · ContactPerson · Address · PriceSlab · CreditLimit · Complaint |
| **Procurement** | Vendor · PurchaseRequisition · PurchaseOrder · POLine · GRN · GRNLine · VendorPayment |
| **Orders** | SalesOrder · OrderLine · Reservation · Dispatch · DispatchLine · DeliveryChallan |
| **Inventory extra** | Batch · SerialNumber · StockTransfer · StockAdjustment · StockTake · StockTakeLine |
| **Projects** | Project · Milestone · Task · MaterialIssue · SiteLog · ProjectExpense · SnagItem · Handover |
| **Finance extra** | Advance · Payment · Expense · ExpenseHead · PettyCash · EmployeeAdvance |
| **People** | Employee · Shift · Attendance · Leave · LeaveBalance · SalaryStructure · SalaryComponent · PayrollRun · Payslip · StatutorySlab |
| **Automation** | AutomationRule · MessageTemplate · MessageLog · WhatsAppConversation · Notification · FollowUp |
| **Platform** | SavedView · Setting · ImportJob · ExportJob |

---

## 10. India compliance

Verified against current rules as of **August 2026**. Re-verify before go-live — these change.

### 10.1 GST computation

```ts
// src/kernel/tax/gst.ts — pure functions, unit tested, used nowhere else
export function computeLineTax(input: {
  taxable: Paise
  gstRate: number
  supplierStateCode: string
  placeOfSupplyCode: string
}): { cgst: Paise; sgst: Paise; igst: Paise }
```

**Rules:**
- Same state → CGST + SGST, each at half the rate. Different state → IGST at the full rate.
- Computed **per line**, not per document — lines can carry different GST rates.
- Round half-up to the nearest paisa per line; round-off to the nearest rupee applied once at the document total.
- Mandatory test cases: intra-state · inter-state · exempt (0%) · mixed-rate document · discount before tax · freight as a separate taxable line · round-off producing ±₹0.50.

### 10.2 e-Invoice (IRN)

| Fact | Value |
|---|---|
| Mandatory threshold | Aggregate annual turnover **> ₹5 crore** in any FY since 2017-18 |
| Applies to | B2B and B2G invoices, exports. **B2C is exempt.** |
| Reporting window | 30 days from invoice date for AATO ≥ ₹10 crore |
| Cancellation | **Only within 24 hours** of IRN generation. After that, issue a credit note. |
| Penalty | ₹10,000 per non-compliant invoice; buyer cannot claim ITC |
| Portal access | MFA mandatory since April 2025 |

**Implementation:**
- Integrate through a **GSP** (ClearTax, Masters India, etc.), not the IRP directly. Budget two weeks for sandbox onboarding.
- `irnStatus`: `NOT_REQUIRED → PENDING → GENERATED → FAILED → CANCELLED`.
- Invoicing must work fully **without** IRN. Generate the IRN asynchronously via the job queue with retry and a visible failure queue. A GSP outage must never block billing.
- The 24-hour cancellation window is enforced in the UI: past it, the Cancel action is replaced by Issue credit note, with the reason shown.

### 10.3 e-Way bill

Required above the state threshold (₹50,000 in most states) for goods movement. Generated from the dispatch, needs transporter ID or vehicle number. Supports vehicle update and validity extension. Ship-to GSTIN is now mandatory.

### 10.4 WhatsApp Cloud API — corrected costs

**Billing changed to per delivered message on 1 July 2025.** The per-conversation model is gone. India moved to INR billing in January 2026.

| Category | Rate (India, from 1 Jan 2026) | Used for |
|---|---|---|
| Marketing | **₹0.8631** / message | Broadcasts, new price list, offers |
| Utility | **~₹0.115** / message | Quote sent, order confirmed, dispatch, invoice, payment reminder |
| Authentication | **~₹0.115** / message | OTP |
| **Service** | **Free, unlimited** | Any reply inside the 24-hour customer service window |

Plus 18% GST (Meta charges are OIDAR imported services — confirm reverse-charge treatment).

**Realistic estimate for Mandovara** — 3,000 utility + 2,000 marketing per month ≈ **₹345 + ₹1,726 ≈ ₹2,100/month + GST**, using the Cloud API directly with no BSP markup.

> **This corrects the ₹5,000–8,000/month figure in the engagement document.** Revise Part 5.3 of that document.

**Build implications:**
- Track and store the **category** of every message; utility versus marketing is a 7.5× cost difference.
- Prefer replying inside the 24-hour service window — those messages are free. The conversation inbox should surface "service window open, closes in 4h 12m".
- Message cost is logged per message in `MessageLog` so the client can see actual spend.
- A WABA billed in USD cannot be converted to INR. **Select INR at WABA creation.**

### 10.5 Payroll statutory

All table-driven and effective-dated in `StatutorySlab`. Never hardcode.

| Item | Note |
|---|---|
| PF | 12% employee + 12% employer, wage ceiling ₹15,000 unless voluntary higher |
| ESI | Applicable below the wage ceiling; employee and employer rates differ |
| Professional tax | **Tamil Nadu slabs, half-yearly.** State-specific and revised periodically. |
| TDS | Section 192, per employee declaration and regime choice |
| Gratuity, bonus | Out of scope for v1 — flag to the client explicitly |

### 10.6 Formatting

Indian digit grouping (`₹16,50,000`), IST throughout, financial year April–March, GSTIN checksum validation, PAN format validation, mobile as 10 digits with `+91` normalisation.

---

## 11. Module build order and acceptance criteria

Full screen-by-screen detail is in `UI-Build-Specification.md`. This section defines **what must be true for the module to be accepted** — the gate the agent must prove it has passed.

| # | Module | Acceptance criteria |
|---|---|---|
| K | **Kernel** | Cross-tenant query returns zero rows in a test that attempts it · unauthorised role receives 403 on every route · 1,000 concurrent invoice-number allocations produce zero gaps and zero duplicates · GST test suite passes all 7 cases · every mutation writes an audit row (proved by test) |
| 1 | **Product Catalog** | 1,200 seeded SKUs · search returns in **< 120ms** measured, matching code, name, brand and spec values · Excel import of 1,200 rows completes with a per-row error report · bulk price revision is versioned and reversible · document sends to WhatsApp in two taps |
| 2 | **Lead Management** | Duplicate detection fires on mobile blur before submit · pipeline board responsive with 500 open leads · lost reason mandatory · one-click conversion carries full history |
| 3 | **Client 360** | Outstanding computed from the ledger, never stored · ageing buckets correct at boundary dates · credit limit blocks an order and permits a reasoned override |
| 4 | **Quotation** | Quote with 20 lines built in under 5 minutes keyboard-only · GST correct for intra-state, inter-state and mixed-rate · discount below floor routes to approval · revision compare shows added/removed/changed · PDF matches the print template exactly |
| 5 | **Follow-up** | Cannot close without next action or outcome · overdue escalates to manager automatically · client can create a rule through the UI with no developer involvement |
| 6 | **Purchase & Vendor** | Partial receipt across multiple GRNs reconciles to the PO · rate comparison shows last rate and lead time per vendor |
| 7 | **Inventory** | **Concurrency test: 50 simultaneous issues of the same SKU never oversell** · ledger is append-only (verified by a test that attempts UPDATE and fails) · stock take variance posts correctly · negative stock blocked, override audited |
| 8 | **Sales Order & Dispatch** | Reservation prevents double-selling · partial dispatch tracks ordered/reserved/dispatched/pending per line · dispatched can never exceed ordered |
| 9 | **Projects** | Profitability reconciles exactly with the stock ledger and expense ledger · reversing a material issue changes the margin correctly · site log works offline and syncs |
| 10 | **Invoicing & GST** | Numbering gap-free under concurrency · advance auto-adjusted and shown as its own line · IRN generated asynchronously with retry · billing works with the GSP down · cancellation blocked after 24 hours with credit-note fallback offered |
| 11 | **Accounts** | One receipt settles multiple invoices with a residual on account · allocation stored as rows · ageing matches a manual calculation on seed data |
| 12 | **Attendance** | Punch works offline and queues · geo-fence enforced · monthly lock prevents back-dated edits · **tested on a 3GB-RAM Android** |
| 13 | **Payroll** | LOP derived from locked attendance · statutory slabs table-driven and effective-dated · review grid allows correction with reason before finalisation · payslip PDF and bank file both produced |
| 14 | **WhatsApp** | Templates cannot be used before Meta approval · replies land against the correct record · message category and cost logged per message · service-window countdown visible |
| 15 | **Reports** | Six role dashboards load in **< 1.5s** · every report exports to Excel and PDF respecting filters · scheduled report delivers on time |
| 16 | **Admin & Audit** | Permission matrix editable at runtime · audit log immutable · full data export produced |

---

## 12. Testing and verification

### 12.1 What must be tested

| Layer | Tool | Coverage requirement |
|---|---|---|
| Money and GST | Vitest | **100%.** Every branch. No exceptions. |
| Stock ledger | Vitest + Testcontainers | 100%, including concurrency |
| Numbering | Vitest + Testcontainers | Concurrency test at 1,000 parallel allocations |
| Permissions | Vitest | Every route × every role |
| Business logic | Vitest | ≥ 80% |
| Critical journeys | Playwright | 100% of the flows in §12.2 |

### 12.2 E2E journeys that must pass before go-live

1. Lead → quotation → order → dispatch → invoice → receipt → outstanding cleared
2. PO → GRN → stock in → project issue → stock out → ledger balances
3. Attendance punch (offline) → sync → month lock → payroll run → payslip
4. Import 1,200 products → search → build quotation → send on WhatsApp
5. Invoice → IRN generation fails → retry succeeds → e-way bill generated
6. Storekeeper logs in → cannot see payroll, margin or cost price anywhere

### 12.3 The concurrency tests that actually matter

These three catch the defects that destroy trust in a business system. Write them in Session 6, before any module depends on the behaviour.

```ts
test('1000 parallel invoice numbers: no gaps, no duplicates')
test('50 parallel issues of the same SKU: never oversells')
test('parallel receipt allocation: never over-allocates an invoice')
```

---

## 13. Security

- Argon2id password hashing. Sessions in httpOnly, secure, sameSite=lax cookies. Rotate on privilege change.
- Rate limit: login 5/min per mobile, API 100/min per user, exports 10/hour.
- Every server action validates input with Zod **and** checks permission. Both, every time.
- Signed URLs for all files, 15-minute expiry. No public buckets.
- Cost price, margin and salary are stripped **server-side** for unauthorised roles — never sent to the client and hidden with CSS.
- Audit log is append-only, with a database rule preventing UPDATE and DELETE.
- Daily automated backup, and a **restore actually tested** before go-live. An untested backup is not a backup.
- Data resident in the India region.
- Secrets in environment variables, never committed. Rotate the WhatsApp system-user token on schedule.

---

## 14. Performance budgets

| Metric | Budget | Measured on |
|---|---|---|
| Catalog search keystroke → results | < 120ms | 1,200 SKUs, p95 |
| List page → interactive | < 1.5s | Mid-range Android, 4G |
| Dashboard load | < 1.5s | 12 months of seed data |
| Quotation PDF generation | < 2s | 30-line quotation |
| Excel import, 1,200 rows | < 60s | Background job with progress |
| Bundle, first load JS | < 180KB gzipped | Excludes lazily loaded 3D |
| Lighthouse performance | ≥ 85 | Desktop, catalog list |

Regressions beyond budget fail CI. Add the check in Session 2, not at the end.

---

## 15. Seed data

Realistic seed data is a build requirement, not a convenience. Ship it in Session 3.

- 1,200 products across 8 categories with authentic Indian trading SKUs — codes, HSN, UOM, brand, category-appropriate specs, multi-tier rates, GST slabs of 5/12/18/28
- 800 clients across Tamil Nadu, Kerala and Karnataka with valid-format GSTINs — enough inter-state clients to exercise IGST
- 60 vendors, 25 users across all 7 roles, 2 branches, 3 warehouses with racks and bins
- 12 months of transaction history: leads, quotations, orders, dispatches, invoices, receipts, expenses, attendance
- Deliberate edge cases: an invoice cancelled after 24h, a partially dispatched order, an SKU below reorder, a 90+ day overdue client, a receipt with an unallocated residual, a project running at negative margin

Without this you cannot prove any performance budget or acceptance criterion.

---

## 16. Execution plan

Twenty sessions. Each has a single objective, an explicit input, and a gate that must pass before the next begins. Paste the prompt, verify the gate, commit, move on.

> **Preface every session prompt with:**
> "Read `CLAUDE.md` and `docs/architecture.md`. Follow the twelve non-negotiable rules in Section 2.1 exactly. If you cannot satisfy a rule, stop and tell me rather than working around it. At the end, run the verification gate and paste the actual output — do not claim completion without evidence."

### Phase A — Foundation (Sessions 1–8)

| # | Objective | Gate |
|---|---|---|
| 1 | Scaffold Next.js 16 + React 19 + Tailwind v4 + Prisma 6 + Vitest + Playwright. Repo structure per §4. CI running typecheck, lint, test. | `pnpm typecheck && pnpm lint && pnpm test` green on an empty suite; CI passes |
| 2 | Design system: `@theme` tokens (§5.2), fonts, `.tabular`, gold hairline, all five screen states (§7.12). A `/styleguide` route rendering every token and state. | Styleguide renders; contrast checker passes AA on all text pairs |
| 3 | **Full Prisma schema, all ~70 models** (§9) + seed script (§15). No application code. | `prisma migrate dev` clean; seed loads 1,200 products in < 60s; `prisma studio` shows correct relations |
| 4 | Kernel part 1: `db.scoped`, RequestContext, RBAC registry, `requirePermission`, audit log. | Test: cross-tenant query returns 0 rows. Test: unauthorised role gets 403. Both pass. |
| 5 | Kernel part 2: money (BigInt paise, `formatINR`), GST pure functions, `@/kernel/datetime`. | GST suite: all 7 cases in §10.1 pass. 100% branch coverage on `tax/` and `money/`. |
| 6 | Kernel part 3: numbering sequences, event bus, approval engine. **Write the three concurrency tests (§12.3).** | 1,000 parallel invoice numbers: zero gaps, zero duplicates. Paste the output. |
| 7 | Kernel part 4: document render engine + quotation and invoice templates. Auth with mobile-number login. | PDF renders byte-identically twice; login works; session rotates on role change |
| 8 | `<DataTable>` and `<EntityForm>` to the full contracts in §7.1–7.2. | Storybook shows default/loading/empty/error; keyboard nav works; server pagination proved against 1,200 seeded products |

### Phase B — Reference module (Sessions 9–11)

| # | Objective | Gate |
|---|---|---|
| 9 | **Product Catalog, entirely by hand.** All 9 screens. Materialised tsvector + trigger, pg_trgm on code, GIN on specs. | Search p95 **< 120ms** across 1,200 SKUs — paste the benchmark |
| 10 | Catalog Excel importer: 4-step wizard, background job, per-row error report, downloadable corrections file. Bulk price revision, versioned. | Import 1,200 rows with 40 deliberate errors; error report identifies all 40; valid rows import |
| 11 | **Extract the entity generator** from the catalog module (§8, `generators/`). Generate Lead Management as the first test. | Generated Lead module passes the same DoD checklist as the hand-written catalog. Show me the diff in quality. |

### Phase C — Generated modules (Sessions 12–18)

| # | Objective | Gate |
|---|---|---|
| 12 | Client 360 + remaining components (`<MoneyInput>`, `<StatusPill>`, `<Timeline>`, `<AgeingBars>`, `<SearchCombobox>`) | Outstanding derived from ledger; ageing correct at boundary dates |
| 13 | Quotation builder + Follow-up engine + rule builder | 20-line quote, keyboard-only, under 5 minutes. Rule created through UI fires correctly. |
| 14 | **Inventory: ledger, GRN, transfer, adjustment, stock take.** Highest-risk module. | 50 parallel issues never oversell — paste the output. UPDATE on ledger fails. |
| 15 | Purchase & Vendor + Sales Order & Dispatch | Partial receipt reconciles to PO; partial dispatch cannot exceed ordered |
| 16 | Invoicing & GST + e-Invoice via GSP + e-way bill | Numbering gap-free under load; billing works with GSP down; 24h cancel rule enforced |
| 17 | Accounts: receipts with multi-invoice allocation, advances, expenses, petty cash, Tally export | Receipt settles 3 invoices with residual on account; Tally export imports cleanly |
| 18 | Projects: milestones, tasks, material issue, site logs, profitability | Profitability reconciles to the stock and expense ledgers exactly |

### Phase D — People, automation, hardening (Sessions 19–20+)

| # | Objective | Gate |
|---|---|---|
| 19 | Attendance (PWA + IndexedDB outbox) + Payroll (table-driven statutory) | Punch offline, sync, lock month, run payroll, produce payslip and bank file |
| 20 | WhatsApp Cloud API: templates, two-way inbox, broadcast, per-message cost logging + 6 role dashboards | Template blocked until approved; reply lands on the right record; cost logged with category |
| 21 | Hardening: all 6 E2E journeys (§12.2), performance budgets (§14), security review (§13), restore test | Every gate in §17 green |

### Sessions that must not be skipped or reordered

**3, 4, 5, 6, 9, 14.** Schema, scoping, money, numbering, catalog search, stock ledger. Every other session is recoverable. These six are not.

---

## 17. Definition of Done — the go-live gate

The system ships when every line below is true and evidenced.

**Correctness**
- [ ] GST test suite: 100% branch coverage, all cases pass
- [ ] 1,000 parallel invoice numbers: zero gaps, zero duplicates
- [ ] 50 parallel stock issues: zero oversell
- [ ] Receipt allocation never exceeds invoice value under concurrency
- [ ] Project profitability reconciles to stock and expense ledgers to the paisa

**Security**
- [ ] Cross-tenant access test returns zero rows
- [ ] Every route tested against every role
- [ ] Cost, margin and salary stripped server-side, verified in the network tab
- [ ] Audit log immutable at the database level
- [ ] Backup **restored** into a clean environment successfully

**Performance**
- [ ] Every budget in §14 met and measured on the target device
- [ ] Dashboards under 1.5s with 12 months of data

**Experience**
- [ ] All six E2E journeys pass
- [ ] Every screen has empty, loading, error and permission-denied states
- [ ] Full keyboard operation including the quotation builder
- [ ] Tested on a 3GB-RAM Android in an actual godown
- [ ] Offline queue survives airplane mode, app close and reopen
- [ ] Tamil locale complete for nav, statuses, validation, payslips, templates
- [ ] `prefers-reduced-motion` respected everywhere
- [ ] WCAG AA contrast verified

**Compliance**
- [ ] e-Invoice generated against the GSP sandbox and production
- [ ] Billing continues working with the GSP unavailable
- [ ] 24-hour cancellation rule enforced with credit-note fallback
- [ ] e-Way bill generated with ship-to GSTIN
- [ ] Tally export imports cleanly into the client's actual company file
- [ ] Payroll matches a manual calculation for 10 employees across 3 salary structures

**Handover**
- [ ] Role-based user manuals, English and Tamil
- [ ] Video SOP library recorded
- [ ] Admin guide and runbook written
- [ ] Source code and data export delivered
- [ ] Four weeks of hypercare scheduled, including the first month-end and first payroll run

---

## Appendix A — `CLAUDE.md` starter

Copy this into the repo root. Keep it under 400 lines.

```markdown
# Mandovara Business OS

Custom ERP for a Tamil Nadu trading and project-execution company.
1,000+ SKUs, field sales, multi-warehouse stock, projects, GST invoicing,
attendance, payroll, WhatsApp automation.

## Users you are building for
Storekeeper (godown, cheap Android, 40 GRN lines) · Accounts clerk (keyboard only,
200 invoices) · Sales exec (phone, in front of a customer) · Site engineer (no signal)
· Owner (10 min/day on a phone). The first four use it 200×/day. Every animation
is a tax they pay 200 times.

## Stack
Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 (CSS-first,
@theme, no config file) · shadcn/ui new-york · PostgreSQL 16 · Prisma 6 · Zod 4 ·
BullMQ · WhatsApp Cloud API · Vitest + Playwright · pnpm

## THE TWELVE RULES — violating any of these fails review
1. Tenant/branch scope in the repository layer only. All queries via db.scoped(ctx).
2. Money is BigInt paise. Never Float. Format only at the render boundary.
3. Stock ledger is append-only. Never UPDATE a balance column.
4. Every mutation writes an audit row.
5. Every mutation emits a domain event.
6. Document numbers from a DB sequence, inside the transaction. Gap-free.
7. GST only in @/kernel/tax. Pure, table-driven, unit-tested.
8. Permissions checked server-side on every route.
9. Full schema up front. Migrations per stage. Never edit a shipped migration.
10. Nothing automated modifies src/kernel/**. Human review only.
11. No file > 300 lines. No `any`. No console.log. No inline styles.
12. Every list is server-paginated.

## Design
"Sovereign" — midnight indigo ground, antique gold used ONCE per screen
(the primary action), all numerals in Geist Mono with tabular-nums,
Indian number format (₹16,50,000), 34px table rows, 13px body.
Details: docs/design.md

## Commands
pnpm dev · pnpm typecheck · pnpm lint · pnpm test · pnpm test:e2e
pnpm db:migrate · pnpm db:seed · pnpm db:studio

## Definition of done
typecheck + lint + unit + integration + permission test + browser at 1440 and 390
+ empty/loading/error/denied states + keyboard-only verified.

## When stuck
If you cannot satisfy a rule above, STOP and say so. Do not work around it.
If the spec is ambiguous, ask one question. Do not guess in the kernel.
```
