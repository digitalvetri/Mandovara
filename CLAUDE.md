# CLAUDE.md — MANDOVARA INTERIOR OS · MASTER BUILD SPECIFICATION

**Product:** Mandovara Interior OS · single tenant: **Mandovara, Coimbatore** (mandovara.com)
**Type:** Measure-to-Install Operating System for interior décor & furnishing, with a built-in **Measure & Material Engine**
**Author:** DigitalVetri.AI · **Spec version:** 1.0 · August 2026
**This file is the single source of truth. If code and this file disagree, this file wins.**

---

## 0. RULES OF ENGAGEMENT (read before writing any code)

1. **Work phase by phase (§14).** Never start phase N+1 until phase N's verification checklist passes. Each phase is self-contained and can run in a fresh session with only this file.
2. **Documentation discovery before implementation.** Phase 0 reads the actual current docs for Next.js 16, Tailwind v4 (CSS-first `@theme`, no config file), Prisma 6 and the WhatsApp Cloud API. Do not invent APIs. If something you expected does not exist, stop and use what the docs actually provide.
3. **Migrations only.** `prisma migrate dev` / `prisma migrate deploy`. **Never `prisma db push`.** Schema history versioned from commit one.
4. **Money is `BigInt` paise, never float.** Measurements are `Decimal(10,2)` in **millimetres**. Areas `Decimal(12,3)` in sqft. Fabric `Decimal(10,3)` in metres.
5. **Every measurement drives a calculation, and every calculation is a pure function in `/lib/calc`** with unit tests. No material maths anywhere else in the codebase. This is the heart of the product — see §7.
6. **Dye lot is recorded, no longer reserved.** *(Amended 19 Aug 2026 at the owner's instruction — the allocation console was removed.)* Every roll of wallpaper, fabric and carpet still carries a `dyeLot`: captured at GRN, carried on `StockBalance` and `StockMove`, and named on the install line that records what physically went on the wall. What is gone is the **reservation** step — nothing locks a lot to an order line, and there is no mixed-lot gate to enforce. "Which lot went on which wall" remains answerable from the ledger; "this lot is spoken for" does not. The `Allocation` model is retained in the schema but is no longer written to or read.
7. **RBAC enforced server-side** in route handlers and server actions, never only hidden in the UI.
8. **Every outbound WhatsApp writes an `AutomationLog` row keyed by `idempotencyKey` before sending.** Retries are no-ops. Store the message **category** — utility ₹0.115 vs marketing ₹0.8631 is a 7.5× cost difference.
9. **Financial, calculation and stock logic ships with tests** (§12). A GST, material-calculation, dye-lot or payroll path without a test is incomplete.
10. **The measurement gate is sacred.** A quotation line for a made-to-measure product **cannot exist** without a linked `MeasurementItem`. The UI must make it physically impossible to quote a curtain or blind from a guess. This mirrors the reality that Mandovara loses money exactly when someone quotes before measuring.
11. **Verify before claiming done.** Run each phase's checklist commands and paste the output. No "should work".

---

## 1. PRODUCT DEFINITION & RESEARCH SYNTHESIS

### 1.1 The customer (researched from mandovara.com, Aug 2026)

Mandovara is an interior décor and furnishing house at **32 Thirumoorthy Layout, Thadagam Road, RS Puram, Coimbatore 641002**. Ten years trading, ~**1,200 projects**, ~**1,000 clients**, ~**22 supplier brands**. Roots in **Arham**, a branded-wallpaper wholesaler since 2014 — which is why the catalog is deep and brand-led rather than commodity.

**They sell nine product families, most made to measure:**

| Family | Sub-types | Sold by | Made to measure? |
|---|---|---|---|
| Curtains | Sheer · Main · Motorized | metre of fabric | **Yes** — cut & stitched |
| Blinds | Cellular · Printed · Motorized · Panel · PVC · Roller · Skylight · Smart · Weather Exterior · Wooden · Zebra | sqft, per blind | **Yes** — cut to opening |
| Wallpaper | — | roll | **Yes** — rolls calculated from wall |
| Flooring | Laminated · SPC · Vinyl · Wooden | sqft / box | **Yes** — area + wastage |
| Carpets | Tile · Wall-to-wall | sqft / tile | **Yes** — seam planning |
| Upholstery | Cushions · Headboards · Sofa | piece / metre | **Yes** — artisan made |
| Vertical Garden | — | sqft | **Yes** |
| Interior Films | Furniture · Glass · Wall decals | sqft | **Yes** |
| Artistical Works | Murals & paintings | project | **Yes** — bespoke |

**Their own stated process, from their website — this is the system's spine:**

> You Know Us (enquiry) → We Know You (requirement) → **A Trial Run: we get to your location for measurements and analysis** → Price Proposal (quote) → **Happy Installation** → Satisfaction (feedback)

### 1.2 The problem

Mandovara runs a **measure-to-install** business on tools built for neither. Consequences that follow directly from that mismatch:

- **Quoting before measuring, or measuring on paper.** Site measurements live in a notebook or a WhatsApp photo. They get transcribed wrong. A curtain quoted at 2× fullness and stitched at 2.5× eats the margin silently.
- **Material calculation done by hand, per quote.** Wallpaper rolls, curtain widths, flooring boxes — each is a small formula with pattern repeat, wastage and hem allowances. Get it wrong low and you re-order; get it wrong high and you carry dead stock in a design nobody else wants.
- **Dye lot mismatch.** Re-ordering one short roll of wallpaper six weeks later produces a visibly different shade on one wall. The job is redone at Mandovara's cost. This is the single most expensive recurring failure in this trade.
- **1,000+ designs across 22 brands with no searchable catalog.** A client asks "do you have this in a lighter grey?" and the answer takes a day and a phone call to the brand.
- **Sample books walk out and never return.** A wallpaper book costs ₹5,000–₹15,000. Nobody knows which architect has which book.
- **Stitching and installation scheduled from memory.** The tailor's queue and the installer's diary are separate from the order book.
- **Architect and designer referrals tracked in someone's head.** Commission disputes, and no view of which referrer actually generates revenue.
- **Project profitability unknown.** A four-room villa with curtains, wallpaper, flooring and a mural is one project with dozens of lines; whether it made money is discovered, if ever, at year end.

### 1.3 Jobs to be done

- **Rohit (MD):** *"When I open my phone in the morning I want to see every live project's stage, what's stuck, and what money is due — in 30 seconds."* / *"When a client says the wallpaper doesn't match, I want to know which lot went to which wall."*
- **Sales / designer:** *"When I'm standing in a client's living room I want to measure, photograph, pick a design from the catalog and have the fabric quantity computed before I leave."*
- **Measurement executive:** *"When I do a site visit I want a checklist per room so I never come back for a second measurement."*
- **Store keeper:** *"When I receive material I want the lot recorded, so six weeks later we can say which lot went where."* (The original job — *"stop me mixing dye lots"* — was retired with the allocation console, 19 Aug 2026.)
- **Tailor / make unit:** *"When a curtain job reaches me I want the cut list and the stitch spec, not a WhatsApp message."*
- **Installer:** *"When I reach a site I want to know exactly what goes in which room and what to collect."*
- **Accounts:** *"When an advance is taken against a project I want it adjusted automatically on the final invoice."*

### 1.4 Positioning

Not a horizontal ERP (Tally / Zoho / Vyapar — no measurement, no material calculation, no dye lot). Not a generic CRM (no make, no install). Not interior-design software (Foyr, SketchUp — visualisation, not operations).

This is an **Interior OS**: the vocabulary of the trade is native — *fullness, pattern repeat, dye lot, railroading, drop match, cut length, mount type, wastage %, sqft slab* — and the sales line is:

> **"You measure once, on your phone, and everything downstream — fabric quantity, roll count, quote, cut list, install sheet — is computed from that one measurement. No retyping, no re-measuring, no dye-lot mistakes."**

### 1.5 Riskiest assumptions & mitigations (build accordingly)

| Assumption | Risk | Mitigation baked into this spec |
|---|---|---|
| Field staff will measure on a phone rather than paper | **High** | Measurement PWA: one window per screen, ≥56px targets, works fully offline, photo per item, Tamil labels, completes a 4-room villa in under 15 minutes |
| Our material formulas match what Mandovara actually does | **High** | §7 formulas are configurable per product family; Phase 0 sits with their tailor and validates every constant against 20 historical jobs before Phase 2 |
| The 1,000+ design catalog can be loaded | Med | Brand → Collection → Design → Colourway importer with per-row error report; brand PDFs and swatch images bulk-attached |
| Dye-lot discipline will be followed | **Now unmitigated** | The system records lots but no longer blocks mixing — the gate was removed 19 Aug 2026 at the owner's instruction. Discipline is a floor process, not a system control. |
| Motorized blinds/curtains add a service dimension | Low | `requiresPowerPoint`, `remoteCount`, `warrantyMonths` fields on the install sheet |

### 1.6 Decisions locked (do not re-litigate) / still open

**Locked:** single tenant, multi-branch-ready schema · catalog hierarchy is **Brand → Collection → Design → Colourway (SKU)**, not category-first · every made-to-measure quote line requires a `MeasurementItem` · dye lot recorded on every roll-based receipt (**reservation and the mixed-lot gate removed 19 Aug 2026 — see §0.6**) · measurement stored in **millimetres**, displayed in the user's chosen unit · money as BigInt paise · design system §6 (**palette re-keyed 19 Aug 2026 on the owner's instruction — see the note at §6.1; the structure, type scale, UX doctrine and screen set are unchanged and remain locked**) · the module set in §8 · the phase order in §14.

**Open (use placeholders, flag in README):** exact fullness/wastage constants per family (validated in Phase 0) · whether stitching is in-house or job-worked (schema supports both via `MakeJob.vendorId` nullable) · GSTIN and e-invoice applicability (only if AATO > ₹5 crore — confirm before Phase 5) · sample-book deposit policy.

---

## 2. TECH STACK (exact)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.2.x (App Router, TypeScript strict)** | 16.x is current stable; Next.js 15 loses support Oct 2026. Turbopack default. |
| React | **19.2.x** | Server Components default; server actions for mutations; `useOptimistic` |
| DB | **PostgreSQL 16** (Supabase, `ap-south-1`) | RLS on every org-owned table |
| ORM | **Prisma 6** | migrations only; client singleton; `relationJoins` preview |
| Auth | Session-based, **mobile number as identity** | Indian SME staff do not use email logins |
| UI | **Tailwind v4** (CSS-first `@theme`, **no `tailwind.config.js`**) + **shadcn/ui** `new-york`, restyled to §6 | no forwardRef, `data-slot`, `sonner` not `toast` |
| Tables | TanStack Table v8 (headless) behind `<DataTable>` | server pagination always |
| Forms | react-hook-form + Zod 4 | one schema per entity, shared client/server |
| Charts | Recharts, sparingly | most "charts" here are plain divs |
| Jobs | BullMQ + Redis | imports, exports, reminders, PDF, WhatsApp |
| Automation | n8n + **WhatsApp Cloud API** (Meta, INR-billed WABA) | webhooks HMAC-signed |
| Files | Supabase Storage, signed URLs 15 min | swatch images, site photos, brand PDFs |
| PDF | `@react-pdf/renderer` server-side | quote, invoice, cut list, install sheet |
| Excel | SheetJS | catalog import/export |
| Testing | Vitest (unit + Testcontainers) + Playwright (e2e) | CI-gated |
| Deploy | Vercel + Supabase; n8n on VPS | India region |
| PM | pnpm | exact pinned versions for next, react, prisma |

**Deliberately excluded:** any state library (RSC + URL state + `useOptimistic` suffices) · GraphQL · any component library beyond shadcn/ui · `moment`/`date-fns` for formatting (use `Intl` with `en-IN`/`Asia/Kolkata` via `/lib/datetime`).

### 2.1 Repository layout

```
/app
  /(auth)/login
  /(app)/                       # office surface
    dashboard · catalog · leads · clients · architects
    projects/[id]/{rooms,measurements,quote,make,install,money,docs}
    quotations · orders · purchase · stock · make · install
    invoices · receipts · expenses · samples
    hr/{attendance,payroll} · whatsapp · reports · settings
  /(field)/m/                   # measurement + install PWA
    measure/[projectId] · install/[visitId] · attendance
  /api/webhooks/{whatsapp,n8n}/route.ts
/lib
  auth.ts          # requireRole(), getContext()
  db.ts            # Prisma singleton + scoped client
  money.ts         # BigInt paise, formatINR, GST split
  units.ts         # mm ↔ inch ↔ ft ↔ m, sqft/sqm
  numbering.ts     # MDV/ENQ-2608-0142 race-safe generator
  calc/            # THE ENGINE — §7. Pure. Fully tested.
    curtain.ts · wallpaper.ts · blind.ts · flooring.ts
    carpet.ts · film.ts · upholstery.ts · index.ts
  automation.ts    # enqueue with idempotencyKey
  datetime.ts
/components/ui              # shadcn restyled
/components/{data,layout,states,measure}
/prisma/schema.prisma + seed.ts
/tests/{unit,e2e}
/docs/DECISIONS.md          # append-only ADR log
```

---

## 3. AUTH & RBAC

### 3.1 Roles (9) and route access

`OWNER · DESIGNER · SALES · MEASURE_EXEC · STORE · MAKE_SUPERVISOR · INSTALLER · ACCOUNTS · HR`

| Route group | Allowed roles |
|---|---|
| `/dashboard` | all (widgets filtered by role) |
| `/catalog` | all read; OWNER, STORE write; **cost & margin: OWNER, ACCOUNTS only** |
| `/leads`, `/clients`, `/architects` | SALES, DESIGNER, OWNER |
| `/projects`, `/quotations`, `/orders` | SALES, DESIGNER, OWNER |
| `/m/measure` | MEASURE_EXEC, DESIGNER, SALES, OWNER |
| `/purchase`, `/stock` | STORE, OWNER |
| `/make` | MAKE_SUPERVISOR, STORE, OWNER |
| `/install`, `/m/install` | INSTALLER, OWNER |
| `/invoices`, `/receipts`, `/expenses` | ACCOUNTS, OWNER |
| `/samples` | SALES, DESIGNER, STORE, OWNER |
| `/hr` | HR, OWNER |
| `/whatsapp`, `/reports`, `/settings` | OWNER (+ ACCOUNTS read on reports) |

Every server action begins `const ctx = await requireRole([...])`, resolving session → user → role, throwing 403 otherwise. **Cost price and margin are stripped server-side** for unauthorised roles — never sent to the client and hidden with CSS.

### 3.2 RLS

Every org-owned table carries `organizationId` (denormalised onto leaf tables too — simpler policies beat elegant joins) with policy `USING (organization_id = current_org_id())`, set via `set_config` in a Prisma `$extends` middleware. UI filtering is not isolation. A leakage test suite is blocking in CI.

---

## 4. NUMBERING & DOMAIN CONVENTIONS

- **Series per year-month, race-safe** via `NumberSequence(series, yymm, counter)` updated in a transaction:
  `ENQ- PRJ- MEA- QT- SO- PO- GRN- MJ- INS- INV- RCT- CN- SMP-`
  Format `MDV/QT-2608-0142`.
- **Measurements stored in millimetres** (`Decimal(10,2)`), always. Display unit is a user preference (mm / inch / feet). One converter in `/lib/units.ts`; no conversion anywhere else.
- **Areas** in sqft `Decimal(12,3)`. **Fabric** in metres `Decimal(10,3)`. **Money** `BigInt` paise.
- **Dye lot** is a free-text code captured at GRN, mandatory for `WALLPAPER`, `CURTAIN_FABRIC`, `SHEER`, `UPHOLSTERY_FABRIC`, `CARPET_ROLL`.
- **Timezone:** IST everywhere; store UTC, render IST. Financial year April–March.
- **GST:** intra-Tamil-Nadu → CGST+SGST split equally; inter-state → IGST. HSN per product. Round half-up per line; single round-off at document total. Common HSN here: wallpaper 4814, woven furnishing fabric 5407/5512, blinds 6303, carpets 5703, laminate flooring 4411, vinyl/SPC 3918, films 3919. **Confirm each with their CA in Phase 0.**
- **Wastage defaults** (configurable per `ProductFamily`, validated in Phase 0):
  flooring straight lay 7% · flooring diagonal 10% · wallpaper 10% · carpet wall-to-wall 10% · curtain fabric hem+heading allowance 300mm.
- **Fullness ratios:** sheer 2.5× · main pinch-pleat 2.5× · main eyelet 2.0× · main pencil-pleat 2.5×. Configurable.
- **Standard fabric widths:** 110cm (narrow, vertical run) · 280cm (wide / railroaded, horizontal run). The engine picks the run direction and warns when railroading is cheaper.
- **Wallpaper roll defaults:** width 530mm, length 10.05m, pattern match `FREE | STRAIGHT | OFFSET(half-drop)`.

---

## 5. DATA MODEL — PRISMA SCHEMA (complete)

> Phase 0 assembles this into `prisma/schema.prisma`, runs `npx prisma validate` and `prisma migrate dev --name init`. Both must pass before anything else is built. Add back-relations if the validator demands them — but do not change field names or types.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"  url = env("DATABASE_URL") }

// ───────────────────────── ENUMS
enum AppRole { OWNER DESIGNER SALES MEASURE_EXEC STORE MAKE_SUPERVISOR INSTALLER ACCOUNTS HR }
enum UserStatus { ACTIVE SUSPENDED }

enum ProductFamily {
  CURTAIN_FABRIC SHEER LINING BLIND WALLPAPER FLOORING CARPET_ROLL CARPET_TILE
  UPHOLSTERY_FABRIC FOAM_FILLING VERTICAL_GARDEN INTERIOR_FILM MURAL
  HARDWARE_TRACK HARDWARE_ROD MOTOR ACCESSORY SERVICE
}
enum SellUnit { METRE ROLL SQFT SQM PIECE SET BOX RUNNING_FT }
enum PatternMatch { FREE STRAIGHT OFFSET }
enum FabricRun { VERTICAL RAILROADED }
enum HeadingType { EYELET PINCH_PLEAT PENCIL_PLEAT RIPPLE_FOLD TAB_TOP ROD_POCKET }
enum MountType { INSIDE OUTSIDE CEILING }
enum OpeningType { WINDOW DOOR WALL FLOOR CEILING FURNITURE OTHER }
enum SurfaceType { WINDOW WALL FLOOR CEILING FURNITURE GLASS }

enum LeadSource { WALK_IN PHONE WHATSAPP WEBSITE INSTAGRAM ARCHITECT_REFERRAL CLIENT_REFERRAL EXHIBITION OTHER }
enum LeadStage { NEW CONTACTED MEASUREMENT_SCHEDULED MEASURED QUOTED NEGOTIATION WON LOST }
enum ClientType { HOMEOWNER ARCHITECT INTERIOR_DESIGNER BUILDER COMMERCIAL GOVERNMENT DEALER }

enum ProjectStage { ENQUIRY MEASUREMENT QUOTATION ORDERED PROCUREMENT MAKE INSTALLATION SNAGGING COMPLETED CANCELLED }
enum MeasurementStatus { DRAFT SUBMITTED APPROVED SUPERSEDED }
enum QuotationStatus { DRAFT SENT REVISED ACCEPTED REJECTED EXPIRED }
enum OrderStatus { DRAFT CONFIRMED PROCUREMENT MAKE READY_TO_INSTALL INSTALLING COMPLETED CANCELLED }

enum POStatus { DRAFT SENT PARTIAL RECEIVED CANCELLED }
enum StockMoveType { GRN_IN ALLOCATE ISSUE_TO_MAKE ISSUE_TO_SITE RETURN_TO_STOCK SCRAP ADJUSTMENT SAMPLE_OUT SAMPLE_IN }
enum MakeJobStatus { QUEUED CUTTING STITCHING FINISHING QC READY DELIVERED }
enum InstallStatus { SCHEDULED IN_PROGRESS COMPLETED PARTIAL RESCHEDULED CANCELLED }
enum SnagStatus { OPEN IN_PROGRESS RESOLVED CLOSED }

enum InvoiceType { TAX PROFORMA CREDIT_NOTE DEBIT_NOTE }
enum InvoiceStatus { DRAFT ISSUED PARTIALLY_PAID PAID CANCELLED }
enum IrnStatus { NOT_REQUIRED PENDING GENERATED FAILED CANCELLED }
enum PaymentMode { CASH UPI NEFT RTGS CHEQUE CARD }
enum ChequeStatus { PENDING CLEARED BOUNCED }

enum SampleStatus { IN_LIBRARY ISSUED OVERDUE RETURNED LOST }
enum AttendanceStatus { PRESENT ABSENT HALF_DAY LEAVE HOLIDAY WEEK_OFF }
enum PayrollStatus { DRAFT APPROVED PAID }
enum MsgCategory { UTILITY MARKETING AUTHENTICATION SERVICE }
enum MsgStatus { QUEUED SENT DELIVERED READ FAILED }
enum ApprovalState { PENDING APPROVED REJECTED }

// ───────────────────────── ORG & PEOPLE
model Organization {
  id String @id @default(cuid())
  name String                      // "Mandovara"
  legalName String?
  gstin String?  pan String?
  addressLine String?  city String? @default("Coimbatore")
  state String? @default("Tamil Nadu")  stateCode String @default("33")
  pincode String? @default("641002")
  phone String?  email String?  website String?
  logoKey String?  letterheadKey String?
  fyStartMonth Int @default(4)
  settings Json                    // wastage %, fullness, roll defaults, terms
  createdAt DateTime @default(now())
  branches Branch[]  users User[]
}

model Branch {
  id String @id @default(cuid())
  organizationId String
  name String                      // "RS Puram Showroom"
  gstin String?  stateCode String @default("33")
  address Json?
  invoicePrefix String @default("MDV")
  org Organization @relation(fields: [organizationId], references: [id])
  @@index([organizationId])
}

model User {
  id String @id @default(cuid())
  organizationId String
  mobile String                    // PRIMARY identity
  email String?
  name String
  passwordHash String?
  role AppRole
  branchIds String[]
  locale String @default("en")     // en | ta
  status UserStatus @default(ACTIVE)
  createdAt DateTime @default(now())
  org Organization @relation(fields: [organizationId], references: [id])
  @@unique([organizationId, mobile])
}

model Employee {
  id String @id @default(cuid())
  organizationId String
  userId String? @unique
  code String
  name String  mobile String
  designation String
  department String                // SALES DESIGN MEASURE STORE MAKE INSTALL ACCOUNTS
  doj DateTime
  salaryStructure Json?            // basic, hra, allowances (BigInt paise as string)
  status UserStatus @default(ACTIVE)
  @@unique([organizationId, code])
}

// ───────────────────────── CATALOG: Brand → Collection → Design → Colourway
model Brand {
  id String @id @default(cuid())
  organizationId String
  name String                      // e.g. "3M", "Aartex", "Divine"
  country String?
  leadTimeDays Int @default(14)
  vendorId String?
  logoKey String?
  isActive Boolean @default(true)
  collections Collection[]
  @@unique([organizationId, name])
}

model Collection {                 // the physical sample "book"
  id String @id @default(cuid())
  organizationId String
  brandId String
  name String                      // "Serene Silks Vol. 3"
  family ProductFamily
  seasonYear Int?
  catalogPdfKey String?
  isActive Boolean @default(true)
  brand Brand @relation(fields: [brandId], references: [id])
  designs Design[]
  sampleBooks SampleBook[]
  @@unique([organizationId, brandId, name])
  @@index([organizationId, family])
}

model Design {
  id String @id @default(cuid())
  organizationId String
  collectionId String
  code String                      // brand's design code
  name String
  family ProductFamily
  // ── physical properties that drive the calculators (§7)
  rollWidthMm Decimal? @db.Decimal(10,2)     // wallpaper 530, carpet 3660
  rollLengthM Decimal? @db.Decimal(10,3)     // wallpaper 10.05
  fabricWidthMm Decimal? @db.Decimal(10,2)   // 1100 or 2800
  patternRepeatMm Decimal? @db.Decimal(10,2)
  patternMatch PatternMatch @default(FREE)
  railroadable Boolean @default(false)
  gsm Int?
  thicknessMm Decimal? @db.Decimal(6,2)
  areaPerBoxSqft Decimal? @db.Decimal(10,3)  // flooring
  tileSizeMm String?                          // carpet tile "500x500"
  specs Json                                  // family-specific attrs
  hsn String
  gstRate Decimal @db.Decimal(5,2)
  isActive Boolean @default(true)
  searchVector Unsupported("tsvector")?
  collection Collection @relation(fields: [collectionId], references: [id])
  colourways Colourway[]
  @@unique([organizationId, collectionId, code])
  @@index([organizationId, family])
}

model Colourway {                  // the sellable SKU
  id String @id @default(cuid())
  organizationId String
  designId String
  code String                      // full SKU
  colourName String                // "Pearl Grey"
  hex String?
  imageKey String?
  sellUnit SellUnit
  moq Decimal? @db.Decimal(10,3)
  isActive Boolean @default(true)
  design Design @relation(fields: [designId], references: [id])
  prices Price[]
  stock StockBalance[]
  @@unique([organizationId, code])
  @@index([organizationId, designId])
}

model Price {
  id String @id @default(cuid())
  organizationId String
  colourwayId String
  tier String                      // COST | MRP | RETAIL | ARCHITECT | PROJECT
  clientId String?                 // client-specific override
  amount BigInt                    // paise per sellUnit
  minChargeSqft Decimal? @db.Decimal(10,3)  // blinds: min billable area
  effectiveFrom DateTime
  effectiveTo DateTime?
  colourway Colourway @relation(fields: [colourwayId], references: [id])
  @@index([colourwayId, tier, effectiveFrom])
}

// Make/labour rates, quoted alongside material
model ServiceRate {
  id String @id @default(cuid())
  organizationId String
  family ProductFamily
  code String                      // STITCH_EYELET, INSTALL_WALLPAPER, LAY_FLOORING
  name String
  unit SellUnit
  amount BigInt
  effectiveFrom DateTime
  @@unique([organizationId, code, effectiveFrom])
}

// ───────────────────────── SAMPLE LIBRARY (books walk out; track them)
model SampleBook {
  id String @id @default(cuid())
  organizationId String
  collectionId String
  barcode String                   // printed label
  costValue BigInt
  status SampleStatus @default(IN_LIBRARY)
  collection Collection @relation(fields: [collectionId], references: [id])
  issues SampleIssue[]
  @@unique([organizationId, barcode])
}

model SampleIssue {
  id String @id @default(cuid())
  organizationId String
  sampleBookId String
  issuedToType String              // CLIENT | ARCHITECT | STAFF
  clientId String?  architectId String?  userId String?
  issuedAt DateTime @default(now())
  dueAt DateTime
  returnedAt DateTime?
  depositAmount BigInt @default(0)
  notes String?
  book SampleBook @relation(fields: [sampleBookId], references: [id])
  @@index([organizationId, dueAt])
}

// ───────────────────────── CRM
model Lead {
  id String @id @default(cuid())
  organizationId String
  number String
  name String  mobile String  email String?
  source LeadSource
  architectId String?              // referral partner
  stage LeadStage @default(NEW)
  siteAddress Json?
  requirement String?
  familiesInterested ProductFamily[]
  budgetMin BigInt?  budgetMax BigInt?
  ownerId String
  lostReason String?
  nextActionAt DateTime?
  convertedClientId String?
  createdAt DateTime @default(now())
  @@unique([organizationId, number])
  @@index([organizationId, stage, ownerId])
  @@index([organizationId, mobile])
}

model Client {
  id String @id @default(cuid())
  organizationId String
  code String
  name String
  type ClientType @default(HOMEOWNER)
  gstin String?  pan String?
  mobile String  altMobile String?  email String?
  billingAddress Json
  priceTier String @default("RETAIL")
  creditLimit BigInt @default(0)
  architectId String?
  notes String?
  createdAt DateTime @default(now())
  contacts ContactPerson[]
  projects Project[]
  @@unique([organizationId, code])
  @@index([organizationId, mobile])
}

model ContactPerson {
  id String @id @default(cuid())
  organizationId String
  clientId String
  name String  designation String?  mobile String  email String?
  whatsappOptIn Boolean @default(true)
  client Client @relation(fields: [clientId], references: [id])
}

model Architect {                  // referral partner — commission is real money here
  id String @id @default(cuid())
  organizationId String
  code String
  firmName String
  contactName String  mobile String  email String?
  commissionPct Decimal @db.Decimal(5,2) @default(0)
  address Json?
  isActive Boolean @default(true)
  commissions ArchitectCommission[]
  @@unique([organizationId, code])
}

model ArchitectCommission {
  id String @id @default(cuid())
  organizationId String
  architectId String
  projectId String
  baseAmount BigInt
  pct Decimal @db.Decimal(5,2)
  amount BigInt
  paidAt DateTime?
  paymentRef String?
  architect Architect @relation(fields: [architectId], references: [id])
  @@index([organizationId, architectId, paidAt])
}

// ───────────────────────── PROJECT · ROOM · MEASUREMENT (the spine)
model Project {
  id String @id @default(cuid())
  organizationId String
  branchId String
  number String                    // MDV/PRJ-2608-0042
  name String                      // "Dr Kannan — Villa, Saibaba Colony"
  clientId String
  architectId String?
  stage ProjectStage @default(ENQUIRY)
  siteAddress Json
  siteContactName String?  siteContactMobile String?
  expectedInstallAt DateTime?
  ownerId String                   // designer/sales owner
  orderValue BigInt @default(0)
  createdAt DateTime @default(now())
  client Client @relation(fields: [clientId], references: [id])
  rooms Room[]
  measurements Measurement[]
  quotations Quotation[]
  orders Order[]
  installVisits InstallVisit[]
  expenses ProjectExpense[]
  snags Snag[]
  documents ProjectDocument[]
  @@unique([organizationId, number])
  @@index([organizationId, stage])
  @@index([organizationId, clientId])
}

model Room {
  id String @id @default(cuid())
  organizationId String
  projectId String
  name String                      // "Master Bedroom", "Living"
  floorLabel String?               // "Ground", "First"
  sortOrder Int @default(0)
  project Project @relation(fields: [projectId], references: [id])
  items MeasurementItem[]
  @@index([projectId])
}

model Measurement {                // one site visit
  id String @id @default(cuid())
  organizationId String
  projectId String
  number String                    // MDV/MEA-2608-0087
  visitedAt DateTime
  measuredById String
  status MeasurementStatus @default(DRAFT)
  approvedById String?  approvedAt DateTime?
  supersedesId String?
  notes String?
  project Project @relation(fields: [projectId], references: [id])
  items MeasurementItem[]
  @@unique([organizationId, number])
  @@index([projectId, status])
}

model MeasurementItem {
  id String @id @default(cuid())
  organizationId String
  measurementId String
  roomId String
  label String                     // "Window 1 — East"
  surface SurfaceType
  openingType OpeningType?
  // ── raw dimensions, ALWAYS millimetres
  widthMm Decimal @db.Decimal(10,2)
  heightMm Decimal @db.Decimal(10,2)
  depthMm Decimal? @db.Decimal(10,2)
  quantity Int @default(1)         // identical windows
  // ── deductions (doors/windows inside a wall)
  deductions Json?                 // [{w,h,qty,label}]
  // ── product-family intent captured on site
  family ProductFamily
  headingType HeadingType?
  fullness Decimal? @db.Decimal(4,2)
  mountType MountType?
  trackTypeNote String?
  requiresPowerPoint Boolean @default(false)
  floorLevelDiffMm Decimal? @db.Decimal(10,2)
  // ── evidence
  photoKeys String[]
  notes String?
  measurement Measurement @relation(fields: [measurementId], references: [id])
  room Room @relation(fields: [roomId], references: [id])
  calc CalcResult?
  quotationLines QuotationLine[]
  @@index([measurementId, roomId])
}

// Immutable output of the engine (§7). Recomputed on input change; old row superseded.
model CalcResult {
  id String @id @default(cuid())
  organizationId String
  measurementItemId String @unique
  colourwayId String?
  engineVersion String             // "curtain@1.2.0"
  inputs Json                      // exact inputs used
  // ── outputs
  materialQty Decimal @db.Decimal(12,3)
  materialUnit SellUnit
  widthsRequired Int?              // curtain panels
  cutLengthMm Decimal? @db.Decimal(10,2)
  rollsRequired Int?
  boxesRequired Int?
  areaSqft Decimal? @db.Decimal(12,3)
  billableAreaSqft Decimal? @db.Decimal(12,3)   // after min-charge
  wastagePct Decimal? @db.Decimal(5,2)
  fabricRun FabricRun?
  seamCount Int?
  liningQty Decimal? @db.Decimal(12,3)
  warnings String[]                // "railroading saves 6.4m", "pattern repeat adds 1 roll"
  computedAt DateTime @default(now())
  item MeasurementItem @relation(fields: [measurementItemId], references: [id])
}
```

*(Schema continues in §5.2 below.)*

### 5.2 Schema continued — quote, order, procurement, make, install, money

```prisma
// ───────────────────────── QUOTATION
model Quotation {
  id String @id @default(cuid())
  organizationId String
  branchId String
  number String                    // MDV/QT-2608-0142
  revision Int @default(0)
  parentId String?
  projectId String
  clientId String
  date DateTime
  validUntil DateTime
  status QuotationStatus @default(DRAFT)
  taxableAmount BigInt @default(0)
  cgst BigInt @default(0)
  sgst BigInt @default(0)
  igst BigInt @default(0)
  roundOff BigInt @default(0)
  total BigInt @default(0)
  discountPct Decimal @db.Decimal(5,2) @default(0)
  termsText String?
  ownerId String
  sentAt DateTime?
  project Project @relation(fields: [projectId], references: [id])
  lines QuotationLine[]
  @@unique([organizationId, number, revision])
  @@index([organizationId, projectId, status])
}

model QuotationLine {
  id String @id @default(cuid())
  organizationId String
  quotationId String
  lineNo Int
  // RULE (§0.10): made-to-measure families MUST carry measurementItemId.
  measurementItemId String?
  roomLabel String?
  colourwayId String?
  serviceRateId String?
  description String
  quantity Decimal @db.Decimal(12,3)
  unit SellUnit
  rate BigInt
  discountPct Decimal @db.Decimal(5,2) @default(0)
  taxable BigInt
  gstRate Decimal @db.Decimal(5,2)
  cgst BigInt  sgst BigInt  igst BigInt
  amount BigInt
  isOptional Boolean @default(false)
  calcSnapshot Json?               // frozen CalcResult at quote time
  quotation Quotation @relation(fields: [quotationId], references: [id])
  item MeasurementItem? @relation(fields: [measurementItemId], references: [id])
  @@index([quotationId])
}

// ───────────────────────── ORDER
model Order {
  id String @id @default(cuid())
  organizationId String
  branchId String
  number String
  projectId String
  clientId String
  quotationId String?
  date DateTime
  status OrderStatus @default(DRAFT)
  totalValue BigInt
  advanceRequired BigInt @default(0)
  advanceReceived BigInt @default(0)
  promisedInstallAt DateTime?
  project Project @relation(fields: [projectId], references: [id])
  lines OrderLine[]
  @@unique([organizationId, number])
  @@index([organizationId, status])
}

model OrderLine {
  id String @id @default(cuid())
  organizationId String
  orderId String
  lineNo Int
  measurementItemId String?
  colourwayId String?
  serviceRateId String?
  description String
  quantity Decimal @db.Decimal(12,3)
  unit SellUnit
  rate BigInt
  amount BigInt
  procuredQty Decimal @db.Decimal(12,3) @default(0)
  madeQty Decimal @db.Decimal(12,3) @default(0)
  installedQty Decimal @db.Decimal(12,3) @default(0)
  order Order @relation(fields: [orderId], references: [id])
  @@index([orderId])
}

// ───────────────────────── PROCUREMENT & STOCK (dye-lot aware)
model Vendor {
  id String @id @default(cuid())
  organizationId String
  code String
  name String
  gstin String?  mobile String  email String?
  address Json?
  paymentTermsDays Int @default(30)
  leadTimeDays Int @default(14)
  brandIds String[]
  rating Int?
  @@unique([organizationId, code])
}

model PurchaseOrder {
  id String @id @default(cuid())
  organizationId String
  number String
  vendorId String
  projectId String?                // project-specific procurement is the norm here
  date DateTime
  expectedAt DateTime?
  status POStatus @default(DRAFT)
  totalValue BigInt
  lines POLine[]
  grns GRN[]
  @@unique([organizationId, number])
}

model POLine {
  id String @id @default(cuid())
  organizationId String
  purchaseOrderId String
  colourwayId String
  quantity Decimal @db.Decimal(12,3)
  unit SellUnit
  rate BigInt
  receivedQty Decimal @db.Decimal(12,3) @default(0)
  po PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
}

model GRN {
  id String @id @default(cuid())
  organizationId String
  number String
  purchaseOrderId String?
  vendorId String
  receivedAt DateTime
  invoiceRef String?
  lines GRNLine[]
  po PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id])
  @@unique([organizationId, number])
}

model GRNLine {
  id String @id @default(cuid())
  organizationId String
  grnId String
  colourwayId String
  quantity Decimal @db.Decimal(12,3)
  rejectedQty Decimal @db.Decimal(12,3) @default(0)
  rate BigInt
  // ── DYE LOT: mandatory for roll/fabric families (§0.6)
  dyeLot String?
  rollCount Int?
  rollLengthsM Json?               // [10.05, 10.05, 7.2] partial rolls matter
  binLocation String?
  grn GRN @relation(fields: [grnId], references: [id])
  @@index([organizationId, colourwayId, dyeLot])
}

model StockBalance {
  id String @id @default(cuid())
  organizationId String
  colourwayId String
  dyeLot String?
  quantity Decimal @db.Decimal(12,3)
  reserved Decimal @db.Decimal(12,3) @default(0)
  value BigInt
  binLocation String?
  updatedAt DateTime @updatedAt
  colourway Colourway @relation(fields: [colourwayId], references: [id])
  @@unique([colourwayId, dyeLot])
  // Materialised from StockMove. Written ONLY by the ledger service,
  // ONLY inside the same transaction, ONLY after SELECT ... FOR UPDATE.
}

model StockMove {
  id String @id @default(cuid())
  organizationId String
  colourwayId String
  dyeLot String?
  type StockMoveType
  quantity Decimal @db.Decimal(12,3)   // always positive; type gives direction
  rate BigInt
  refType String                        // GRN | ORDER | MAKE_JOB | INSTALL | SAMPLE | ADJUSTMENT
  refId String
  projectId String?
  occurredAt DateTime
  createdById String
  createdAt DateTime @default(now())
  @@index([organizationId, colourwayId, dyeLot, occurredAt])
  @@index([organizationId, refType, refId])
  // APPEND ONLY. No UPDATE, no DELETE. Reversals are new opposing rows.
}

// Reservation locks a specific dye lot to a project — this is what prevents mismatch
model Allocation {
  id String @id @default(cuid())
  organizationId String
  orderLineId String
  colourwayId String
  dyeLot String?
  quantity Decimal @db.Decimal(12,3)
  mixedLotOverride Boolean @default(false)
  overrideReason String?
  overrideById String?
  createdAt DateTime @default(now())
  @@index([organizationId, orderLineId])
}

// ───────────────────────── MAKE (cut & stitch)
model MakeJob {
  id String @id @default(cuid())
  organizationId String
  number String                    // MDV/MJ-2608-0311
  orderId String
  projectId String
  vendorId String?                 // null = in-house
  status MakeJobStatus @default(QUEUED)
  assignedToId String?
  targetDate DateTime?
  startedAt DateTime?  completedAt DateTime?
  lines MakeJobLine[]
  @@unique([organizationId, number])
  @@index([organizationId, status])
}

model MakeJobLine {
  id String @id @default(cuid())
  organizationId String
  makeJobId String
  orderLineId String
  measurementItemId String?
  roomLabel String
  // ── the cut list, straight from CalcResult
  panels Int?
  cutLengthMm Decimal? @db.Decimal(10,2)
  fabricIssuedM Decimal? @db.Decimal(12,3)
  liningIssuedM Decimal? @db.Decimal(12,3)
  headingType HeadingType?
  eyeletCount Int?
  stitchSpec String?
  actualUsedM Decimal? @db.Decimal(12,3)
  wastageM Decimal? @db.Decimal(12,3)
  qcPassed Boolean @default(false)
  qcNotes String?
  job MakeJob @relation(fields: [makeJobId], references: [id])
  @@index([makeJobId])
}

// ───────────────────────── INSTALLATION
model InstallCrew {
  id String @id @default(cuid())
  organizationId String
  name String
  leadEmployeeId String
  memberEmployeeIds String[]
  skills ProductFamily[]
  isActive Boolean @default(true)
}

model InstallVisit {
  id String @id @default(cuid())
  organizationId String
  number String                    // MDV/INS-2608-0155
  projectId String
  orderId String
  crewId String?
  scheduledAt DateTime
  status InstallStatus @default(SCHEDULED)
  startedAt DateTime?  completedAt DateTime?
  rescheduleReason String?
  clientSignatureKey String?
  photoKeys String[]
  notes String?
  project Project @relation(fields: [projectId], references: [id])
  lines InstallLine[]
  @@unique([organizationId, number])
  @@index([organizationId, scheduledAt, status])
}

model InstallLine {
  id String @id @default(cuid())
  organizationId String
  installVisitId String
  orderLineId String
  roomLabel String
  plannedQty Decimal @db.Decimal(12,3)
  installedQty Decimal @db.Decimal(12,3) @default(0)
  dyeLotUsed String?
  remoteSerials String[]           // motorized
  photoKeys String[]
  issue String?
  visit InstallVisit @relation(fields: [installVisitId], references: [id])
  @@index([installVisitId])
}

model Snag {
  id String @id @default(cuid())
  organizationId String
  projectId String
  roomLabel String?
  raisedById String
  raisedAt DateTime @default(now())
  description String
  photoKeys String[]
  status SnagStatus @default(OPEN)
  assignedToId String?
  resolvedAt DateTime?
  resolutionNote String?
  project Project @relation(fields: [projectId], references: [id])
  @@index([organizationId, status])
}

// ───────────────────────── MONEY
model Invoice {
  id String @id @default(cuid())
  organizationId String
  branchId String
  number String
  type InvoiceType @default(TAX)
  projectId String?
  orderId String?
  clientId String
  date DateTime
  dueDate DateTime
  placeOfSupplyCode String
  taxableAmount BigInt
  cgst BigInt  sgst BigInt  igst BigInt
  roundOff BigInt
  total BigInt
  advanceAdjusted BigInt @default(0)
  status InvoiceStatus @default(DRAFT)
  irn String?  ackNo String?  ackDate DateTime?  qrCode String?
  irnStatus IrnStatus @default(NOT_REQUIRED)
  irnError String?
  ewbNumber String?  ewbValidUntil DateTime?
  cancelledAt DateTime?  cancelReason String?
  lines InvoiceLine[]
  @@unique([organizationId, branchId, number])
  @@index([organizationId, clientId, status])
}

model InvoiceLine {
  id String @id @default(cuid())
  organizationId String
  invoiceId String
  lineNo Int
  orderLineId String?
  description String
  hsn String
  quantity Decimal @db.Decimal(12,3)
  unit SellUnit
  rate BigInt
  taxable BigInt
  gstRate Decimal @db.Decimal(5,2)
  cgst BigInt  sgst BigInt  igst BigInt
  amount BigInt
  invoice Invoice @relation(fields: [invoiceId], references: [id])
}

model Advance {
  id String @id @default(cuid())
  organizationId String
  projectId String
  clientId String
  amount BigInt
  adjusted BigInt @default(0)
  receivedAt DateTime
  mode PaymentMode
  reference String?
  @@index([organizationId, projectId])
}

model Receipt {
  id String @id @default(cuid())
  organizationId String
  number String
  clientId String
  projectId String?
  date DateTime
  mode PaymentMode
  reference String?
  chequeStatus ChequeStatus?
  chequeDate DateTime?
  amount BigInt
  unallocated BigInt @default(0)
  allocations ReceiptAllocation[]
  @@unique([organizationId, number])
}

model ReceiptAllocation {
  id String @id @default(cuid())
  organizationId String
  receiptId String
  invoiceId String
  amount BigInt
  receipt Receipt @relation(fields: [receiptId], references: [id])
  // Explicit rows. NEVER subtract from an invoice balance column.
  @@index([invoiceId])
}

model ProjectExpense {
  id String @id @default(cuid())
  organizationId String
  projectId String
  head String                      // TRANSPORT LABOUR SITE_MISC SCAFFOLD FOOD
  description String
  amount BigInt
  billKey String?
  incurredAt DateTime
  approvalState ApprovalState @default(PENDING)
  approvedById String?
  project Project @relation(fields: [projectId], references: [id])
  @@index([organizationId, projectId])
}

model Expense {                    // non-project overhead
  id String @id @default(cuid())
  organizationId String
  branchId String
  head String
  subHead String?
  description String
  amount BigInt
  billKey String?
  incurredAt DateTime
  approvalState ApprovalState @default(PENDING)
  @@index([organizationId, incurredAt])
}

// ───────────────────────── HR
model Attendance {
  id String @id @default(cuid())
  organizationId String
  employeeId String
  date DateTime @db.Date
  status AttendanceStatus
  inAt DateTime?  outAt DateTime?
  inLat Decimal? @db.Decimal(10,7)  inLng Decimal? @db.Decimal(10,7)
  selfieKey String?
  projectId String?                // site attendance maps to a project
  otHours Decimal? @db.Decimal(5,2)
  lockedAt DateTime?
  @@unique([employeeId, date])
  @@index([organizationId, date])
}

model Leave {
  id String @id @default(cuid())
  organizationId String
  employeeId String
  type String                      // CASUAL SICK EARNED COMP_OFF
  fromDate DateTime @db.Date
  toDate DateTime @db.Date
  days Decimal @db.Decimal(4,1)
  reason String?
  state ApprovalState @default(PENDING)
  approvedById String?
}

model StatutorySlab {              // NEVER hardcode a rate
  id String @id @default(cuid())
  organizationId String
  kind String                      // PF ESI PT TDS
  stateCode String?
  fromAmount BigInt  toAmount BigInt?
  rate Decimal? @db.Decimal(6,3)
  flatAmount BigInt?
  effectiveFrom DateTime
  effectiveTo DateTime?
  @@index([organizationId, kind, effectiveFrom])
}

model PayrollRun {
  id String @id @default(cuid())
  organizationId String
  month Int  year Int
  status PayrollStatus @default(DRAFT)
  approvedById String?  approvedAt DateTime?
  payslips Payslip[]
  @@unique([organizationId, month, year])
}

model Payslip {
  id String @id @default(cuid())
  organizationId String
  payrollRunId String
  employeeId String
  daysPresent Decimal @db.Decimal(4,1)
  lopDays Decimal @db.Decimal(4,1)
  otHours Decimal @db.Decimal(6,2) @default(0)
  earnings Json                    // {basic, hra, conveyance, ot, incentive}
  deductions Json                  // {pf, esi, pt, tds, advance}
  netPay BigInt
  pdfKey String?
  run PayrollRun @relation(fields: [payrollRunId], references: [id])
  @@unique([payrollRunId, employeeId])
}

// ───────────────────────── AUTOMATION & PLATFORM
model MessageTemplate {
  id String @id @default(cuid())
  organizationId String
  name String
  metaTemplateName String
  category MsgCategory
  language String                  // en | ta
  bodyText String
  variables String[]
  metaStatus String @default("DRAFT")   // DRAFT SUBMITTED APPROVED REJECTED
  @@unique([organizationId, metaTemplateName, language])
}

model AutomationLog {
  id String @id @default(cuid())
  organizationId String
  idempotencyKey String @unique    // written BEFORE send (§0.8)
  templateId String?
  category MsgCategory
  toMobile String
  refType String?  refId String?
  status MsgStatus @default(QUEUED)
  metaMessageId String?
  costPaise BigInt @default(0)     // utility 12 · marketing 87 (approx)
  error String?
  sentAt DateTime?  deliveredAt DateTime?  readAt DateTime?
  createdAt DateTime @default(now())
  @@index([organizationId, createdAt])
}

model WhatsAppConversation {
  id String @id @default(cuid())
  organizationId String
  mobile String
  clientId String?  leadId String?  projectId String?
  serviceWindowExpiresAt DateTime? // replies inside this are FREE
  assignedToId String?
  lastMessageAt DateTime
  @@unique([organizationId, mobile])
}

model AutomationRule {
  id String @id @default(cuid())
  organizationId String
  name String
  triggerEvent String              // quotation.sent, payment.due, sample.overdue
  conditions Json
  actions Json
  isActive Boolean @default(true)
}

model FollowUp {
  id String @id @default(cuid())
  organizationId String
  refType String  refId String
  ownerId String
  dueAt DateTime
  note String
  outcome String?
  nextActionAt DateTime?
  completedAt DateTime?
  escalatedAt DateTime?
  @@index([organizationId, ownerId, dueAt])
}

model ProjectDocument {
  id String @id @default(cuid())
  organizationId String
  projectId String
  type String                      // DRAWING APPROVAL PHOTO_BEFORE PHOTO_AFTER HANDOVER WARRANTY
  fileKey String  fileName String
  uploadedById String
  createdAt DateTime @default(now())
  project Project @relation(fields: [projectId], references: [id])
}

model NumberSequence {
  id String @id @default(cuid())
  organizationId String
  series String                    // ENQ PRJ MEA QT SO PO GRN MJ INS INV RCT SMP
  yymm String
  counter Int @default(0)
  @@unique([organizationId, series, yymm])
}

model AuditLog {
  id String @id @default(cuid())
  organizationId String
  actorId String
  entityType String  entityId String
  action String
  before Json?  after Json?
  ip String?
  createdAt DateTime @default(now())
  @@index([organizationId, entityType, entityId])
  // DB rule blocks UPDATE and DELETE.
}

model SavedView {
  id String @id @default(cuid())
  organizationId String
  userId String?
  role AppRole?
  tableKey String
  name String
  config Json
}

model Setting {
  id String @id @default(cuid())
  organizationId String
  key String
  value Json
  @@unique([organizationId, key])
}
```

**Raw SQL migration must also add:** `tsvector` column + trigger on `Design`; GIN index on it; `pg_trgm` GIN index on `Design.code` and `Colourway.code`; GIN index on `Design.specs`; rules blocking UPDATE/DELETE on `AuditLog` and `StockMove`.

---

## 6. DESIGN SYSTEM — "SOVEREIGN" (royal UI, era-best UX)

### 6.1 Direction

> **Revised 19 Aug 2026 at the owner's request** ("neat, colourful, premium; change the colour combo"). The direction below replaces the original antique-gold-on-navy scheme. Everything in §6.1–6.2 is now descriptive of `src/app/globals.css`; §6.3–6.4 are unchanged.

Restraint over decoration, but built on the brand's own colour rather than a borrowed one. **Studio Porcelain** is the default surface: a warm near-white canvas framed by an L-shaped rail of deep teal-ink, with Mandovara's own brand teal as the single hero accent. **Malachite** is the dark theme, re-keyed off the same teal-green hue so the accent belongs to its ground instead of sitting on it. **The UI must not look cheaper than what Mandovara sells.**

The accent is `#2BA89A`, taken from the butterfly mark — the one colour in this system that is not ours to choose. On light grounds it deepens to `#007B6C` so it can carry text at 4.5:1. It is reserved for the single primary action per screen, the active nav item, the focus ring and data bars. Nothing else.

Antique gold is **demoted**, not deleted: it survives as the rare hairline and the sample-book chip. Its tokens stay defined because `:focus-visible`, `.hairline` and `/styleguide` read them.

Colour discipline is enforced arithmetically, not by eye. Every text colour in both themes clears **4.5:1** on every ground it is used against; the light values were solved for the lightest, most saturated `oklch` that still clears the floor. Re-tinting by hand will break it — re-solve instead.

**Signature element:** the **swatch chip** — a 4px rounded colour block carrying the actual colourway hex or swatch image, on the left edge of every catalog row, quote line, cut-list line and install line. Scan the left margin and read the whole job by colour. Second signature: KPI numerals in mono with a hairline gold underline that draws in once on load (240ms).

### 6.2 Tokens

```css
/* src/app/globals.css is the source of truth; this is the shape of it.
   TOKEN NAMES ARE FROZEN — ~1,400 utility usages depend on them. Re-key the
   VALUES to change the look; never rename a token. */

@theme {                                  /* Studio Porcelain — light, DEFAULT */
  --color-ink:        oklch(0.965 0.005 180);   /* #F2F5F4 page ground */
  --color-surface:    oklch(1.000 0.000 0);     /* #FFFFFF card        */
  --color-surface-2:  oklch(0.950 0.006 180);
  --color-border:     oklch(0.885 0.009 180);
  --color-text:       oklch(0.245 0.020 200);   /* #152324  16.1:1     */
  --color-text-muted: oklch(0.470 0.016 200);   /* #4B5859   6.8:1     */
  --color-text-subtle:oklch(0.532 0.014 200);   /* #636F6F   4.5:1     */

  --color-sidebar:      oklch(0.190 0.030 195); /* the dark rail       */
  --color-sidebar-text: oklch(0.970 0.006 190);

  --color-accent:     oklch(0.516 0.105 182);   /* #007B6C brand teal  */
  --color-gold:       oklch(0.534 0.105 85);    /* demoted to hairline */

  --color-solid:      oklch(0.514 0.135 158);   /* ready · paid        */
  --color-heat:       oklch(0.542 0.130 62);    /* in progress         */
  --color-fault:      oklch(0.556 0.190 25);    /* overdue · mismatch  */
  --color-info:       oklch(0.532 0.130 250);

  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
  --shadow-sm/md/lg: …                          /* light theme only    */
}

:root.dark {                              /* Malachite — dark, opt-in */
  --color-ink:     oklch(0.155 0.022 190);
  --color-surface: oklch(0.205 0.024 190);
  --color-text:    oklch(0.965 0.006 190);
  --color-accent:  oklch(0.720 0.115 182);      /* #37BCAA  7.6:1      */
  --shadow-sm/md/lg: none;                      /* lifts with border   */
}
```

**Theme mechanism:** light is `:root` and is the default; dark is opt-in via a
`dark` class on `<html>`, set from the `theme` cookie in `app/layout.tsx` and
toggled by `ThemeToggle`. (It was the inverse before this revision — a `light`
class over a dark default.)

**Cascade layers matter here.** Element-level rules (`input`, `select`) live in
`@layer base`. Tailwind v4 puts utilities in `@layer utilities`, and an
*unlayered* rule beats any layered one regardless of specificity — so an
unlayered `input { background: … }` silently defeats `bg-transparent` on every
input in the app.

**Chrome vs canvas.** The topbar and rail are dark in *both* themes. Controls
mounted on them use the `.on-chrome` utility, which derives from the sidebar
tokens; using `bg-surface` there renders a white pill with white text in the
light theme. Dropdown *panels* still use `bg-surface` — they float over the
canvas, not the chrome.

**Type:** Fraunces (display, weight 560, tracking −0.015em, `font-optical-sizing:auto`) · Inter (UI body, 13px base) · **Geist Mono with `tabular-nums` for every numeral** — ₹, mm, metres, sqft, roll counts, dates · Noto Sans Tamil on field surfaces.
Scale: display 32/38 · h1 26/32 · h2 20/28 · h3 16/24 · body 13/20 · caption 12/16 · eyebrow 11 caps +0.08em.
Motion: 140/200/260ms `cubic-bezier(.2,0,0,1)`, exposed as `--t-fast` /
`--t-base` / `--t-slow` and `--ease`; respect `prefers-reduced-motion`. Shadows
only in the light theme; dark uses border + surface-2 lift.

**Entrance animation is CSS-only** — `.rise`, `.fade-in`, and `.stagger` on a
container so children deal themselves out by `nth-child` rather than every call
site gaining a delay prop. Interactive surfaces use `.lift`, buttons `.press`.

Fill mode is **`backwards`, never `both`**. A filled-forwards animation keeps
asserting its final keyframe, and an animated declaration outranks a normal
one — so `rise` ending on `transform: none` silently beats every
`:hover { transform: … }` beneath it and kills the lift on every card it
touches. `backwards` applies the from-state during the delay and then hands the
element back to its own styles. Elements are naturally opaque, so the
reduced-motion path still lands them visible. Both halves are pinned by
`tests/e2e/motion-a11y.spec.ts`; the failure is invisible in code review.

### 6.3 UX doctrine (what "best in this era" means, concretely)

1. **⌘K command palette everywhere** — jump to any project, client, design code, quote or invoice; create anything; run "chase overdue" and "who has this sample book".
2. **Role-perfect landing.** MD → cockpit. Designer → my projects. Measure exec → today's visits. Store → allocation queue. Make supervisor → cut list. Installer → today's route. Accounts → outstanding. Never a generic home.
3. **Optimistic UI + Undo toasts** for every non-financial mutation. Financial mutations confirm explicitly and name the amount.
4. **The measurement PWA is the product's front door.** One item per screen, ≥56px targets, numeric keypad, unit toggle, photo capture, Tamil labels, **fully offline with an IndexedDB queue**. A four-room villa must be measurable in under 15 minutes with no signal.
5. **Live calculation.** Type a width and the fabric metres, roll count or box count updates in the same breath, with the warning line beneath it ("railroading saves 6.4 m", "pattern repeat adds 1 roll"). This is the moment the product earns its price.
6. **Dye lot is visible everywhere.** Lot code renders as a mono chip beside every stock balance, cut-list line and install line. *(The mixed-lot inline gate went with the allocation console, 19 Aug 2026.)*
7. **Empty states are invitations** — icon, one line, the primary action. Never a bare table.
8. **Skeletons, never spinners.** No full-page loading state in the product.
9. **Keyboard-first office:** every row focusable, `Enter` opens, `n` new, `/` filter, `⌘Enter` submit.
10. **Print is a first-class surface:** quotation, cut list, install sheet, delivery note, GST invoice — each pixel-faithful, on letterhead, ready to hand to a tailor or an installer.
11. **Accessibility floor:** contrast ≥ 4.5:1 both themes, status = dot + word never colour alone, 2px gold focus ring, labelled inputs, announced errors.
12. **Numbers behave like instruments:** tabular mono, Indian grouping (₹16,50,000), deltas as ▲▼ pills, no layout shift on update.

### 6.4 Key screens (route → content; build exactly these)

- `/dashboard` — greeting; 4 KPI cards (live projects, awaiting measurement, ready to install, outstanding); project board by stage with swatch chips; today's install route; overdue sample books; money strip (OWNER/ACCOUNTS only).
- `/catalog` — brand rail → collection grid → design list with swatch thumbnails; filters by family, brand, pattern match, price band, in-stock. Search across design code, name, brand, colour name. **Sub-200ms.**
- `/catalog/design/[id]` — hero swatch, colourway strip, physical properties (roll width, repeat, match), price tiers, live stock **by dye lot**, which projects used it, sample-book location, brand PDF.
- `/projects/[id]` — the hub. Tabs: Rooms & Measurements · Quotation · Order · Procurement · Make · Install · Money · Documents · Snags. Header shows stage stepper, client, architect, order value, margin (OWNER only).
- `/projects/[id]/measurements` — room accordion; each item a card with dimensions, family, photo, and the **live calc result** with its warnings.
- `/m/measure/[projectId]` — the field PWA. Room picker → add item → surface type → width/height with unit toggle → family → heading/mount → photo → next. Offline queue indicator. One-thumb operation.
- `/quotations/[id]` — split view: line grid left, live branded PDF right. Lines pull from measurement items; rate auto-fills from the client's tier; GST computed per line. Discount below floor routes to approval. Revision compare shows added/removed/changed.
- `/make` — kanban QUEUED / CUTTING / STITCHING / FINISHING / QC / READY. Card = room, panels, cut length, fabric issued. **Print cut list** is the primary action.
- `/install` — calendar and route view by crew and day; visit sheet with room-by-room lines, dye lot used, photo capture, client signature.
- `/m/install/[visitId]` — installer PWA: room list, tick off, photo, capture signature, raise snag.
- `/samples` — book library with barcode, status, who holds it, days overdue; issue and return flows; overdue list is a WhatsApp-nudge action.
- `/invoices`, `/receipts` — GST invoicing with advance auto-adjust; receipt settling multiple invoices with residual on account.
- `/reports` — project profitability, family-wise margin, architect-wise revenue and commission, conversion by source, dead stock by dye lot, wastage by tailor.

---

## 7. THE MEASURE & MATERIAL ENGINE (the differentiator)

Everything else in this system is table stakes. **This is the product.** It lives in `/lib/calc`, is pure, has no I/O, and is the only place material maths exists. Every function takes explicit inputs, returns a `CalcResult` shape, and emits human-readable `warnings`.

All constants come from `Organization.settings` — **never hardcode a fullness ratio or wastage percentage.** Phase 0 validates every one of them against 20 historical Mandovara jobs before Phase 2 begins.

### 7.1 Curtains — `calcCurtain()`

```
INPUTS  windowWidthMm, windowHeightMm, quantity, fullness,
        headingType, fabricWidthMm, patternRepeatMm, patternMatch,
        railroadable, sideHemMm, headingAllowanceMm, bottomHemMm, liningRequired

VERTICAL RUN (fabric width 1100mm typical):
  trackWidth      = windowWidthMm + (overlapMm ?? 0)
  requiredWidth   = trackWidth × fullness
  widths          = ceil((requiredWidth + sideHemMm×2) / fabricWidthMm)
  rawCutLength    = windowHeightMm + headingAllowanceMm + bottomHemMm
  cutLength       = patternRepeatMm > 0
                      ? ceil(rawCutLength / patternRepeatMm) × patternRepeatMm
                      : rawCutLength
  fabricMetres    = (widths × cutLength) / 1000

RAILROADED RUN (fabric width 2800mm, pattern permitting):
  possible only if patternMatch = FREE AND railroadable AND
                   (windowHeightMm + allowances) ≤ fabricWidthMm
  fabricMetres    = (requiredWidth + sideHemMm×2) / 1000

DECISION: compute both when legal; choose the cheaper; emit a warning naming the saving.

LINING: same widths, cutLength without pattern repeat.
EYELETS: eyeletCount = round(requiredWidth / eyeletSpacingMm) per panel, rounded to even.

OUTPUT  materialQty(m) · widthsRequired · cutLengthMm · liningQty · fabricRun · warnings
```

**Test cases (mandatory):** 1800×2100 sheer at 2.5× on 1100mm plain → expect 5 widths, 12.0m · same with 640mm repeat → cut length rounds to 2560mm, 12.8m · 3000×1200 on 2800mm railroadable free-match → railroaded wins, warning fires · pattern repeat larger than the drop → warning + fall back to vertical · fullness 2.0 eyelet → even eyelet count.

### 7.2 Wallpaper — `calcWallpaper()`

```
INPUTS  wallWidthMm, wallHeightMm, deductions[], rollWidthMm, rollLengthM,
        patternRepeatMm, patternMatch, wastagePct

cutLength   = FREE     → wallHeightMm
              STRAIGHT → ceil(wallHeightMm / repeat) × repeat
              OFFSET   → ceil((wallHeightMm + repeat/2) / repeat) × repeat
stripsPerRoll = floor((rollLengthM × 1000) / cutLength)
stripsNeeded  = ceil(wallWidthMm / rollWidthMm)
rolls         = ceil(stripsNeeded / stripsPerRoll)

DEDUCTIONS: only subtract an opening if its area > 1.5 sqm AND it spans a full strip.
            Otherwise ignore — partial strips are not reusable. Emit a warning saying so.
WASTAGE:    apply wastagePct, then re-ceil to whole rolls.

OUTPUT  rollsRequired · stripsPerRoll · cutLengthMm · areaSqft · warnings
```

**Test cases:** 4000×2700 free match, 530×10.05m → 3 strips/roll, 8 strips, 3 rolls · same with 640mm straight repeat → cut 3200mm, 3 strips/roll, 3 rolls · same with offset → cut 3520mm, 2 strips/roll, 4 rolls, warning "half-drop match adds 1 roll" · a 900×2100 door inside the wall → **not** deducted, warning explains why.

### 7.3 Blinds — `calcBlind()`

```
INPUTS  widthMm, heightMm, quantity, mountType, minChargeSqft, roundToMm

INSIDE mount  → deduct clearance (default 6mm each side)
OUTSIDE mount → add overlap (default 75mm each side, 100mm top)
CEILING mount → width as given, height to floor minus 12mm

roundedW/H  = ceil(dim / roundToMm) × roundToMm   (roundToMm default 25)
areaSqft    = (roundedW × roundedH) / 92903.04
billable    = max(areaSqft, minChargeSqft) × quantity

MOTORIZED: flag requiresPowerPoint, add motor + remote as separate order lines.

OUTPUT  areaSqft · billableAreaSqft · warnings ("min charge applied: 10 sqft vs actual 6.2")
```

### 7.4 Flooring — `calcFlooring()`

```
INPUTS  roomLengthMm, roomWidthMm (or areaSqft), areaPerBoxSqft,
        layPattern (STRAIGHT|DIAGONAL|HERRINGBONE), wastagePct

area        = (L × W) / 92903.04
wastage     = STRAIGHT 7% · DIAGONAL 10% · HERRINGBONE 15%   (org-configurable)
withWastage = area × (1 + wastage)
boxes       = ceil(withWastage / areaPerBoxSqft)
underlay    = same area, sold by roll or sqm
skirting    = perimeter running feet (minus door openings)

OUTPUT  areaSqft · boxesRequired · underlayQty · skirtingRft · warnings
```

### 7.5 Carpets — `calcCarpet()`

```
WALL-TO-WALL (roll goods, typical roll width 3660mm):
  if roomWidthMm ≤ rollWidthMm  → single drop, length = roomLengthMm, seams = 0
  else → drops = ceil(roomWidthMm / rollWidthMm)
         seams = drops − 1
         lengthM = (drops × roomLengthMm) / 1000
         warn: "N seam(s) required — confirm seam placement with client"
  Pattern repeat, where present, extends each drop as in wallpaper.

TILES:
  tilesNeeded = ceil(area / tileAreaSqft) × (1 + wastagePct)
  boxes       = ceil(tilesNeeded / tilesPerBox)
```

### 7.6 Interior films & vertical garden — `calcFilm()`, `calcVerticalGarden()`

Film: `areaSqft` with roll-width strip logic identical to wallpaper, free match, wastage 8%; frosted/patterned films get pattern-repeat treatment.
Vertical garden: `areaSqft` → panel count by panel size, plus irrigation running feet and plant count per sqft (org-configurable density).

### 7.7 Engine rules

1. Every function is **pure**, versioned (`curtain@1.2.0`), and its version stored on `CalcResult.engineVersion`. Changing a formula never silently re-prices a sent quote.
2. Every function returns **warnings in plain English** — these render directly in the UI and in the printed quote's notes.
3. `CalcResult` is recomputed whenever its `MeasurementItem` changes; the previous row is superseded, never edited.
4. When a quotation is **sent**, the `CalcResult` is frozen into `QuotationLine.calcSnapshot`. A later engine change cannot alter a sent quote.
5. Unit tests cover every branch of every formula, plus the twelve worked examples in §7.1–7.5. **100% branch coverage on `/lib/calc` is a blocking CI gate.**
6. The `MakeJobLine` cut list is generated **from `CalcResult`, not re-derived**. One source of truth from site to tailor.

---

## 8. MODULE MAP

| # | Module | Core entities | Phase |
|---|---|---|---|
| 1 | Catalog & Sample Library | Brand, Collection, Design, Colourway, Price, SampleBook | 1 |
| 2 | CRM | Lead, Client, ContactPerson, Architect | 2 |
| 3 | Project & Rooms | Project, Room, ProjectDocument | 2 |
| 4 | **Measurement** | Measurement, MeasurementItem, CalcResult | 2 |
| 5 | Quotation | Quotation, QuotationLine | 3 |
| 6 | Order | Order, OrderLine | 3 |
| 7 | Procurement | Vendor, PurchaseOrder, POLine, GRN, GRNLine | 4 |
| 8 | Stock & Dye Lot | StockMove, StockBalance (~~Allocation~~ — console removed 19 Aug 2026, model retained unused) | 4 |
| 9 | Make | MakeJob, MakeJobLine | 5 |
| 10 | Installation | InstallCrew, InstallVisit, InstallLine, Snag | 5 |
| 11 | Invoicing & GST | Invoice, InvoiceLine, Advance | 6 |
| 12 | Receipts & Expenses | Receipt, ReceiptAllocation, ProjectExpense, Expense | 6 |
| 13 | Architect Commission | ArchitectCommission | 6 |
| 14 | HR | Employee, Attendance, Leave, PayrollRun, Payslip, StatutorySlab | 7 |
| 15 | WhatsApp & Follow-up | MessageTemplate, AutomationLog, WhatsAppConversation, AutomationRule, FollowUp | 8 |
| 16 | Reports & Admin | SavedView, Setting, AuditLog, NumberSequence | 8 |

---

## 9. AUTOMATION LAYER (Phase 8)

Every send writes `AutomationLog` with `idempotencyKey` **before** dispatch. Store `category` — utility ₹0.115 vs marketing ₹0.8631 is a **7.5× cost difference**. Replies inside the 24-hour service window are **free**; the inbox shows a live countdown so staff reply while it is open.

| Trigger | To | Category | Timing |
|---|---|---|---|
| Enquiry received | Client | Utility | Immediately |
| Measurement visit scheduled | Client | Utility | On schedule + reminder 2h before |
| Measurement completed | Client | Utility | On submit — "quote in 24h" |
| Quotation sent | Client | Utility | On send, PDF attached |
| Quotation unanswered | Client + owner task | Utility | Day 3, 7, 14 |
| Advance received | Client | Utility | On entry |
| Material arrived | Client | Utility | On GRN against their project |
| Make job ready | Client | Utility | On QC pass |
| Install scheduled | Client + crew | Utility | On schedule + 1 day before |
| Install completed | Client | Utility | On signature — includes warranty note |
| Snag raised | Owner + assignee | Utility | Immediately |
| Payment due | Client + Accounts task | Utility | 3 days before, due date, +7, +15 |
| **Sample book overdue** | Holder | Utility | Day after due, then weekly |
| Low stock on fast-moving design | Store | Utility | Daily 9:00 |
| New collection launched | Segment | **Marketing** | On demand, opt-in only |
| Festival / offer campaign | Segment | **Marketing** | Scheduled |

n8n handles scheduling and retries; webhooks HMAC-signed. Templates in **English and Tamil**, blocked from use until `metaStatus = APPROVED`.

---

## 10. API & CODE CONVENTIONS

- **Server actions** for all mutations; typed route handlers only for webhooks and file streams.
- Every action: `const ctx = await requireRole([...])` → Zod parse → business logic → audit row → domain event. In that order, every time.
- `/lib/db.ts` exports the **only** Prisma client; `scoped(ctx)` applies `organizationId` and branch filters via `$extends`. No raw `prisma.` outside `/lib/db.ts` — enforced by an ESLint boundary rule.
- Money: `BigInt` paise end to end. `formatINR()` in `/lib/money.ts` is the only currency formatter; `toLocaleString('en-US')` fails lint.
- Units: `/lib/units.ts` is the only converter. Store mm; convert at the render boundary.
- Numbering: `nextNumber(series)` uses `NumberSequence` inside the caller's transaction. Gap-free.
- Errors: typed `AppError` with a `userMessage` that names the next action. Never "Something went wrong."
- No file over 300 lines. No `any`. No `console.log`. No inline styles.

---

## 11. SEED DATA (must feel like a real Coimbatore interiors house)

- **Organization:** Mandovara, 32 Thirumoorthy Layout, Thadagam Road, RS Puram, Coimbatore 641002 · +91 8940430051 · mandovara22@gmail.com · state code 33.
- **22 brands** with collections across all nine families. **~120 collections, ~1,200 designs, ~3,500 colourways** with realistic physical properties: wallpaper 530mm × 10.05m with a mix of free/straight/offset repeats; curtain fabrics at 1100mm and 2800mm; laminate flooring 2.2 sqft/box; carpet rolls at 3660mm; carpet tiles 500×500.
- **9 users** covering every role · **18 employees** across sales, design, measure, store, make, install.
- **1,000 clients** — homeowners, architects, builders, commercial — Coimbatore-weighted with some Tiruppur, Erode, Salem, and a handful of inter-state to exercise IGST.
- **40 architects** with commission percentages.
- **1,200 projects** across every stage, spread over 24 months, with rooms, measurements, calc results, quotes, orders, make jobs, install visits and money.
- **Deliberate edge cases:** a project where the offset repeat added a roll · a railroading decision that saved 6 m · a mixed-lot override with a reason · a sample book 40 days overdue with an architect · a snag reopened twice · a cheque that bounced and restored outstanding · a project running at negative margin · a motorized blind order awaiting a power point.

Without this, no performance budget or acceptance criterion can be proved.

---

## 12. TESTING & QUALITY GATES

### 12.1 Unit (Vitest) — blocking coverage
- `/lib/calc/**` — **100% branch coverage.** Every worked example in §7.1–7.5.
- `/lib/money.ts` — GST intra-state, inter-state, exempt, mixed-rate document, discount before tax, round-off at ±₹0.50.
- `/lib/units.ts` — mm↔inch↔ft↔m round-trips, sqft/sqm.
- `/lib/numbering.ts` — 1,000 parallel allocations: zero gaps, zero duplicates.
- Dye lot — allocating across two lots without an override throws.
- Payroll — LOP from locked attendance; PT/PF/ESI read from `StatutorySlab`, never constants.

### 12.2 E2E (Playwright) — all must pass before launch
1. Enquiry → schedule measurement → measure offline on mobile → sync → quote → send on WhatsApp → accept → order.
2. Order → PO → GRN with dye lot → make job → cut list printed → install visit → client signature → invoice → receipt. The lot must be traceable from stock to install line.
3. Measure a wallpaper wall with an offset repeat; verify roll count and the warning; change to free match; verify it drops by one roll.
4. *(Retired 19 Aug 2026 with the allocation console. Was: attempt a mixed-lot allocation; verify the block; override with a reason; verify the audit row.)*
5. Issue a sample book, let it pass due, verify the overdue nudge fires and the library shows the holder.
6. Log in as INSTALLER; verify cost price and margin appear nowhere in any network response.

### 12.3 Isolation suite (blocking in CI)
Cross-org read returns zero rows for every org-owned model. Every route tested against every role.

### 12.4 Definition of done per phase
typecheck · lint · unit · e2e for that phase · verified at 1440px and 390px · empty/loading/error/permission-denied states · keyboard-only pass · **paste the command output.**

---

## 13. ENVIRONMENT

```
DATABASE_URL=                 # Supabase ap-south-1
DIRECT_URL=
REDIS_URL=
SESSION_SECRET=
STORAGE_BUCKET=
WHATSAPP_PHONE_NUMBER_ID=     # INR-billed WABA
WHATSAPP_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=          # webhook HMAC
N8N_WEBHOOK_SECRET=
GSP_BASE_URL=                 # e-invoice, only if AATO > ₹5 crore
GSP_CLIENT_ID=
GSP_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=
```

**Lead-time items — start these in week one:** Meta Business verification and an **INR-billed** WABA (1–3 weeks; a USD WABA cannot be converted). GSP sandbox only if e-invoicing applies.

---

## 14. PHASED EXECUTION PLAN (run in order; each phase self-contained)

### Phase 0 — Discovery, validation & foundation *(no features)*
Read current docs for Next.js 16, Tailwind v4 CSS-first theming, Prisma 6, WhatsApp Cloud API. Scaffold repo per §2.1 with CI (typecheck, lint, test). Assemble `prisma/schema.prisma` from §5, `prisma validate`, `migrate dev --name init`, write `seed.ts` per §11.
**Then the critical non-code task:** sit with Mandovara's tailor, installer and store keeper and validate every constant in §7 — fullness ratios, hem and heading allowances, wastage percentages, eyelet spacing, minimum blind charge, standard fabric and roll widths — against **20 historical jobs**. Record each in `docs/DECISIONS.md`.
✅ *Gate:* migrate + seed clean, seed under 60s; all §7 constants confirmed in writing; CI green.

### Phase 1 — Shell, design system, catalog
App shell, auth, RBAC, ⌘K palette, all five screen states, `<DataTable>`, `<EntityForm>`, swatch chip. Catalog: brand → collection → design → colourway, tsvector + pg_trgm search, image handling, price tiers, bulk Excel import with per-row error report. Sample library with barcode issue/return.
✅ *Gate:* search p95 **< 200ms** across 3,500 colourways (paste the benchmark); cost price absent from network payload for a SALES login; import 1,200 designs with 40 deliberate errors and produce the corrections file.

### Phase 2 — CRM, projects, and the Measurement engine
Leads, clients, architects. Project and rooms. Measurement web + **the field PWA**. `/lib/calc` in full with 100% branch coverage.
✅ *Gate:* all §7 test cases pass with coverage report pasted; measure a 4-room villa offline on a real Android, close the browser, reopen, reconnect, confirm sync; calc results and warnings render live.

### Phase 3 — Quotation & Order
Quotation builder with live PDF, revisions, discount approval, GST per line. **Enforce §0.10: no made-to-measure line without a `measurementItemId`.** Order conversion.
✅ *Gate:* build a 25-line multi-room quote keyboard-only in under 8 minutes; attempt a curtain line without a measurement and show it blocked server-side; GST suite passes.

### Phase 4 — Procurement, stock & dye lot
Vendors, PO, GRN with dye lot and roll lengths, append-only `StockMove`, materialised `StockBalance`. *(The allocation console and its mixed-lot gate were removed 19 Aug 2026 — see §0.6.)*
✅ *Gate:* direct UPDATE on `StockMove` fails at the DB; stock issue under concurrency never drives a balance negative.

### Phase 5 — Make & Installation
Make kanban, cut list generated **from `CalcResult`**, fabric issue and wastage capture. Install crews, calendar and route, installer PWA with photo and signature, snag register.
✅ *Gate:* a curtain job flows measurement → quote → order → cut list with identical panel count and cut length at every step; install visit completes offline and syncs with signature.

### Phase 6 — Money
GST invoicing with advance auto-adjust, e-invoice via GSP if applicable (async, retry, **billing works with GSP down**, 24-hour cancel rule), receipts with multi-invoice allocation, project expenses, architect commission, project profitability.
✅ *Gate:* 1,000 parallel invoice numbers — zero gaps, zero duplicates; receipt settles three invoices leaving a residual; bounce the cheque and confirm outstanding restores; profitability reconciles to the stock and expense ledgers to the paisa.

### Phase 7 — HR
Attendance PWA with GPS and selfie, geo-fence, month lock, leave, payroll from `StatutorySlab`, payslip PDF, bank file.
✅ *Gate:* punch offline → sync → lock month → run payroll for 10 employees across 3 structures → reconcile every line against a manual calculation (paste the comparison).

### Phase 8 — Automation, reports, hardening
WhatsApp templates with Meta approval gating, two-way inbox with service-window countdown, per-message cost logging, follow-up rule builder, six role dashboards, all reports. Then: full E2E suite, performance budgets, security review, **restore the backup into a clean environment and run E2E against it**.
✅ *Gate:* every line of §12 green with evidence; unapproved template blocked; utility vs marketing cost logged correctly.

---

## 15. NON-NEGOTIABLES (re-read before every phase)

1. **No made-to-measure quotation line without a `MeasurementItem`.** Enforced server-side, not just in the form.
2. **`/lib/calc` is pure, versioned, and 100% branch-covered.** Material maths exists nowhere else.
3. **Sent quotes freeze their `calcSnapshot`.** An engine change never re-prices a sent quote.
4. **Dye lot on every roll-based receipt**, and carried through stock to the install line. *(The mixed-lot block was removed 19 Aug 2026 at the owner's instruction — see §0.6. Recording is still non-negotiable; blocking is gone.)*
5. **`StockMove` and `AuditLog` are append-only** at the database level.
6. **Money is BigInt paise; measurements are millimetres.** One formatter, one converter.
7. **Document numbers from `NumberSequence` inside the transaction.** Gap-free.
8. **RBAC server-side on every route; cost and margin stripped server-side**, never CSS-hidden.
9. **Never `prisma db push`.** Migrations only.
10. **Every WhatsApp send is idempotent and logs its category and cost.**
11. **The measurement PWA works fully offline.** A site visit with no signal must lose nothing.
12. **Verify before claiming done.** Paste the output.

---

## Appendix — what changed versus the signed proposal, and why it matters

The signed Proposal v1.0 and Master Engagement Document v2.0 describe a **generic trading business**: catalog → stock → dispatch → invoice, with Projects as a secondary module. Research into mandovara.com shows that is not what Mandovara does.

Mandovara is a **measure-to-install** house. Their own published process is *enquiry → **site measurement** → quote → **installation** → feedback*. Nine product families, almost all made to measure, across ~22 brands.

**Seven capabilities the signed scope does not contain, and without which the system will not be used:**

| Missing | Why it is load-bearing |
|---|---|
| **Site measurement module + field PWA** | Every order begins here. Without it the system starts at the quote, i.e. after the data was already written on paper. |
| **Material calculation engine (§7)** | Fabric metres, wallpaper rolls, flooring boxes. This is where margin is made and lost, and it is done by hand today. |
| **Dye-lot tracking** ~~and mixed-lot gate~~ | The single most expensive recurring failure in furnishing. Tracking remains; the gate was removed 19 Aug 2026 at the owner's instruction. |
| **Make / cut-and-stitch job cards** | Curtains and upholstery are manufactured. There is no production step in the signed scope at all. |
| **Installation scheduling and installer PWA** | Their process literally ends in installation. Dispatch-and-challan does not describe it. |
| **Sample-book library** | ₹5,000–₹15,000 per book, walking out of the showroom, untracked. |
| **Architect referral commission** | A primary revenue channel in this trade and a recurring source of dispute. |

**Two things in the signed scope that matter far less than assumed:** multi-warehouse stock valuation (they hold project-allocated material, not warehouses), and sales-order-to-dispatch (goods go to a site with an installer, not on a challan to a customer's gate).

**Recommended action:** raise these in Phase 0 discovery with Rohit as a scope amendment. It is a larger and more valuable system than the one quoted at ₹16,50,000 — realistically ₹19–22 lakh — and far more likely to be adopted, because it matches the work they actually do. Present it as *"we researched your business properly and the system got better,"* which is true.
