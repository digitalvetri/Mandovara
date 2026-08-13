# MEASUREMENT MODULE — Build Specification

**Mandovara CRM · Track B · Weeks 8–13**
Self-contained. You do not need any other document open to build this.

> Drop this at `docs/MEASUREMENT-MODULE.md`. Point Claude Code at it with the prompt in §11.

---

## 1. Why this module matters

Mandovara is an interior furnishing company in Coimbatore selling wallpaper stickers, flooring stickers and curtains — all made to measure. Their own published process is:

> enquiry → **we come to your location and measure** → price proposal → installation

**This module is the front door of the entire business.** Every rupee that flows through this system starts as a dimension captured here. Downstream, that single number becomes the roll count, the fabric metres, the quotation line, the tailor's cut list and the installer's sheet. Nothing is retyped.

Today those dimensions live in a notebook or a WhatsApp photo. They get transcribed wrong, and the error surfaces at the tailor or on the wall — by which point the material is cut and the cost is Mandovara's.

**Your user** is a measurement executive standing in a half-built villa, on a ₹9,000 Android, with one bar of signal and dusty hands. Every design decision in this file follows from that.

---

## 2. Scope

### In scope

| Surface | Route | Who |
|---|---|---|
| Measurement rounds list | `/projects/[id]/measurements` | Office |
| Measurement detail with live calc | `/projects/[id]/measurements/[measurementId]` | Office |
| **Field capture PWA** | `/m/measure/[projectId]` | Measurement executive |
| Sketch canvas | component | Field |
| Conflict review | `/m/measure/conflicts` | Field + office |

Plus: approval, revision chain, offline outbox, photo capture and compression.

### Out of scope — do not build

- The material formulas themselves. You build against the **interface** in §4; the engine is a separate module.
- Quotation lines that consume `CalcResult`. Owned by Track A.
- Site visit scheduling. Separate module — a measurement may link to a `SiteVisit` but does not create one.
- Make job cards and cut lists. Downstream, Weeks 13–16.

---

## 3. Data model

The slice you need. Assume it exists in `prisma/schema.prisma`; do not modify the schema — raise changes in the daily sync.

```prisma
model Measurement {
  id             String @id @default(cuid())
  organizationId String
  projectId      String
  number         String                    // MDV/MEA-2608-0087
  siteVisitId    String?
  visitedAt      DateTime
  measuredById   String
  status         MeasurementStatus @default(DRAFT)
  approvedById   String?
  approvedAt     DateTime?
  supersedesId   String?                   // full revision history retained
  revision       Int @default(0)
  notes          String?
  items          MeasurementItem[]
  @@unique([organizationId, number])
  @@index([projectId, status])
}

model MeasurementItem {
  id             String @id @default(cuid())
  organizationId String
  measurementId  String
  roomId         String
  label          String                    // "Window 1 — East", "North Wall"
  surface        SurfaceType               // WALL FLOOR WINDOW CEILING FURNITURE
  // ── raw dimensions, ALWAYS millimetres
  widthMm        Decimal @db.Decimal(10,2)
  heightMm       Decimal @db.Decimal(10,2)
  quantity       Int @default(1)           // identical windows
  deductions     Json?                     // [{w,h,qty,label}] doors inside a wall
  // ── intent captured on site
  family         ProductFamily
  headingType    HeadingType?              // curtains
  fullness       Decimal? @db.Decimal(4,2) // curtains
  layPattern     LayPattern?               // flooring
  requiresPowerPoint Boolean @default(false)
  // ── evidence
  photoKeys      String[]
  sketchKey      String?
  notes          String?
  calc           CalcResult?
  @@index([measurementId, roomId])
}

model CalcResult {
  id                 String @id @default(cuid())
  organizationId     String
  measurementItemId  String @unique
  colourwayId        String?
  engineVersion      String                // "wallpaper@1.0.0"
  inputs             Json                  // exact inputs used
  materialQty        Decimal @db.Decimal(12,3)
  materialUnit       SellUnit
  rollsRequired      Int?
  boxesRequired      Int?
  stripsPerRoll      Int?
  panelsRequired     Int?
  cutLengthMm        Decimal? @db.Decimal(10,2)
  areaSqft           Decimal? @db.Decimal(12,3)
  wastagePct         Decimal? @db.Decimal(5,2)
  fabricRun          FabricRun?
  liningQty          Decimal? @db.Decimal(12,3)
  warnings           String[]              // plain English, shown to the user
  computedAt         DateTime @default(now())
}

enum MeasurementStatus { DRAFT SUBMITTED APPROVED SUPERSEDED }
enum SurfaceType { WALL FLOOR WINDOW CEILING FURNITURE }
enum LayPattern { STRAIGHT DIAGONAL HERRINGBONE }
enum HeadingType { EYELET PINCH_PLEAT PENCIL_PLEAT RIPPLE_FOLD TAB_TOP ROD_POCKET }
```

---

## 4. The calc engine interface

**Do not implement the formulas here.** If `/lib/calc` does not exist yet, define this interface, stub it to return zeroed results with a `"calculation engine not yet available"` warning, and build the entire module against the interface. Swapping in the real engine must require **zero changes** to this module.

```ts
export type CalcInput = {
  family: ProductFamily
  widthMm: number
  heightMm: number
  quantity: number
  deductions?: { w: number; h: number; qty: number; label: string }[]
  headingType?: HeadingType
  fullness?: number
  layPattern?: LayPattern
  colourway?: {
    rollWidthMm?: number
    rollLengthM?: number
    fabricWidthMm?: number
    patternRepeatMm?: number
    patternMatch?: 'FREE' | 'STRAIGHT' | 'OFFSET'
    railroadable?: boolean
    areaPerBoxSqft?: number
  }
  settings: OrgCalcSettings      // wastage %, fullness defaults, hem allowances
}

export type CalcOutput = {
  engineVersion: string
  materialQty: number
  materialUnit: SellUnit
  rollsRequired?: number
  boxesRequired?: number
  stripsPerRoll?: number
  panelsRequired?: number
  cutLengthMm?: number
  areaSqft?: number
  wastagePct?: number
  fabricRun?: 'VERTICAL' | 'RAILROADED'
  liningQty?: number
  warnings: string[]
}

/** PURE. No I/O. No database. No fetch. */
export function calculate(input: CalcInput): CalcOutput
```

---

## 5. The five surfaces

### 5.1 Measurement rounds list — `/projects/[id]/measurements`

Columns: `number` · visit date · measured by · `status` pill · item count · rooms covered · `revision`.

Superseded rounds collapse **under** their replacement rather than disappearing. A user must always be able to see what the dimensions were before someone re-measured, and who changed them.

Primary action: **New measurement round**.

### 5.2 Measurement detail — `/projects/[id]/measurements/[measurementId]`

Room accordion. Each item renders as a card:

```
┌─────────────────────────────────────────────────────────┐
│ ▌ Window 1 — East              WINDOW · CURTAIN_FABRIC  │
│                                                          │
│   1,800 mm  ×  2,100 mm   × 2                           │
│   Eyelet · fullness 2.0                                 │
│                                                          │
│   ┌────────┐  ┌────────┐        MATERIAL                │
│   │ photo  │  │ sketch │        12.80 m fabric          │
│   └────────┘  └────────┘        5 panels · cut 2,560 mm │
│                                                          │
│   ⚠ Pattern repeat 640 mm adds 0.8 m to the cut length   │
└─────────────────────────────────────────────────────────┘
```

The material block is the live `CalcResult`. **Warnings render in full, in plain English, directly beneath.** They are written for Rohit's client to read, not for a developer.

Owner and Designer see an **Approve** action, which locks the round.

### 5.3 Field capture PWA — `/m/measure/[projectId]` · **the core**

One item per screen. Nothing else. No nav chrome — a back arrow and a progress count.

```
Flow:  room picker → add item → label → surface type →
       width → height → quantity → family →
       family-specific fields → photo → sketch → next item
```

```
┌──────────────────────────────┐
│ ←   Master Bedroom      3/7  │
│──────────────────────────────│
│                              │
│  Label                       │
│  ┌────────────────────────┐  │
│  │ Window 1 — East        │  │
│  └────────────────────────┘  │
│                              │
│  Width            [mm ▾]     │
│  ┌────────────────────────┐  │
│  │ 1800                   │  │  ← numeric keypad
│  └────────────────────────┘  │
│                              │
│  Height           [mm ▾]     │
│  ┌────────────────────────┐  │
│  │ 2100                   │  │
│  └────────────────────────┘  │
│                              │
│  ── LIVE ──                  │
│  12.80 m · 5 panels          │
│  ⚠ repeat adds 0.8 m         │
│                              │
│  [📷 Photo]   [✏ Sketch]     │
│                              │
│         ┌─────────────────┐  │
│         │   NEXT ITEM  →  │  │ ← gold, thumb-reachable
│         └─────────────────┘  │
│──────────────────────────────│
│ ⏱ Offline — 3 queued         │
└──────────────────────────────┘
```

**The live calculation is the moment this product earns its price.** Type a width and the fabric metres update in the same breath, with the warning beneath. Budget: **under 100ms**.

### 5.4 Sketch canvas

Freehand drawing over the captured photo, or on a blank canvas. Pointer events, three stroke widths, undo, clear. Saved as an image on `sketchKey`.

**Do not build layers, shapes, text or colour selection.** Executives draw bay windows, pillars and false-ceiling steps. That is all this is for. Anything more is time taken from the offline queue.

### 5.5 Conflict review — `/m/measure/conflicts`

Two versions side by side, differing dimensions highlighted in `--color-fault`. Actions: keep server version (default, already applied), or promote the local version with a reason that writes an audit row.

---

## 6. Business rules — enforce server-side, not in the form

1. **Dimensions are always stored in millimetres**, `Decimal(10,2)`. The display unit (mm / inch / feet) is a user preference. Convert **only** at the render boundary, **only** via `/lib/units`. No conversion arithmetic anywhere else in this module.

2. **`CalcResult` is recomputed whenever its `MeasurementItem` changes.** The previous row is **superseded, never edited**. Store `engineVersion` on every result so a later engine change is traceable and can never silently re-price something already quoted.

3. **Required to save an item:** `label`, `surface`, `widthMm`, `heightMm`, `family`. Photo is strongly encouraged but **not blocking** — a site visit with no signal must never be able to fail because a camera did not respond.

4. **Family-specific required fields:**

| Family | Also required |
|---|---|
| `CURTAIN_FABRIC` · `SHEER` | `headingType`, `fullness` |
| `FLOORING_STICKER` | `layPattern` |
| `WALLPAPER_STICKER` | `deductions` array (may be empty) |

5. **Edit permissions.** Only the assigned measurer, the project owner, a Designer or the Owner may edit a `DRAFT` round. Once `SUBMITTED` it is read-only except to an approver. Enforce with `requirePermission()` and `assignedScope()` — never by hiding a button.

6. **Revisions.** A new round sets `supersedesId` on the old one and increments `revision`. Old rounds are **never edited and never deleted.**

7. **Every mutation** writes an audit row and emits a domain event.

---

## 7. Offline — the hard part, not an enhancement

- Writes go to an **IndexedDB outbox first**, then optimistically to the UI, then to the server when connectivity returns.
- Every queued item carries a **client-generated ID** so retries are idempotent.
- **Photos compress client-side before queueing.** Target ≤300KB, longest edge 1600px. A 4MB photo will never sync on a site connection.
- **The queue must survive the browser being closed and reopened.** Test this explicitly — most implementations lose it on `unload`.
- Persistent banner: `Working offline — 3 entries queued`. Queued rows carry a mono clock badge.

### Conflict policy — decide it now, not later

**Server wins. The rejected version is stored, never discarded.**

Nothing is silently overwritten. Silent data loss here means a curtain is cut to the wrong size and nobody finds out until installation day — the worst failure this system can produce. The loser surfaces in §5.5.

---

## 8. Design

"Sovereign" tokens from `globals.css`. **Never hardcode a colour.**

Midnight indigo ground · **one gold element per screen** (the primary action) · every numeral in `Geist Mono` with `tabular-nums` · `Fraunces` for the page title only.

**Field PWA specifics:**

- Tap targets **≥ 56px**
- **Numeric keypad** on every dimension field (`inputMode="decimal"`)
- One-thumb operation; primary action bottom-right
- Unit toggle **always visible**, never buried in settings
- Tamil labels available, from the user's `locale`
- `prefers-reduced-motion` disables everything

---

## 9. Performance budgets — measured on a 3GB-RAM Android over 4G

| Metric | Budget |
|---|---|
| Measurement screen interactive | **< 1.5s** |
| Add item → next item ready | **< 300ms** |
| Live calc updates as you type | **< 100ms** |
| Field bundle first-load JS | **< 150KB** gzipped |
| Four-room villa measured end to end | **< 15 minutes** |

A desktop Chrome emulation will lie to you about scroll performance and photo capture. Test on the actual device.

---

## 10. Tests required

**Unit**
- Unit conversion round-trips (mm ↔ inch ↔ feet) at boundary values
- Family-specific required-field validation
- Revision chain — superseding preserves the prior round intact

**Integration**
- `CalcResult` recomputes and supersedes on dimension change
- `engineVersion` recorded on every result

**Permission**
- A Sales Executive not assigned to the project gets **403, not an empty page**
- A `SUBMITTED` round cannot be edited by its own measurer

**E2E**
- Capture 4 rooms with 12 items offline → close the browser → reopen → reconnect → all 12 sync with photos and sketches
- Two sessions edit the same item offline → server wins → loser appears in the conflict review screen

---

## 11. The prompt

Paste this into Claude Code.

````
Build the MEASUREMENT module for Mandovara CRM as a standalone, self-contained
module, exactly as specified in docs/MEASUREMENT-MODULE.md.

Read CLAUDE.md and docs/MEASUREMENT-MODULE.md in full before starting.
Follow the twelve non-negotiable rules in CLAUDE.md exactly. If you cannot
satisfy one, STOP and tell me rather than working around it.

Build all five surfaces in §5:
  1. Measurement rounds list
  2. Measurement detail with live calc results and warnings
  3. The field capture PWA — this is the core, build it first and best
  4. Sketch canvas
  5. Conflict review screen

Non-negotiable for this module:
  - Dimensions stored in millimetres only; convert only via /lib/units
  - CalcResult superseded on change, never edited; engineVersion recorded
  - Photo is NOT required to save an item
  - Offline outbox in IndexedDB that survives the browser closing
  - Photos compressed client-side to ≤300KB before queueing
  - Conflict policy: server wins, loser stored and surfaced, never discarded
  - Permissions enforced server-side via requirePermission and assignedScope

If /lib/calc does not exist yet, DO NOT implement the formulas. Define the
interface in §4, stub it to return zeroed results with a
"calculation engine not yet available" warning, and build the entire module
against that interface. Swapping in the real engine must require zero changes
to this module.

BEFORE writing any code, give me:
  - A short plan
  - An ASCII wireframe of the field PWA item-capture screen
  - The offline outbox architecture in five lines
I want to see the flow before you build it.

Then build it. Tests per §10. Empty, loading, error and permission-denied
states on every surface. Verified at 1440px and 390px.

GATE — do not tell me this is done without pasting:
  1. Test output including coverage
  2. A step-by-step walkthrough with screenshots of a 4-room villa measured
     with mobile data OFF, the browser closed, reopened, reconnected, and all
     items synced with photos and sketches intact
  3. Measured timings against every budget in §9

If you cannot hit a budget, say so and tell me what it would take.
Do not quietly ship something slower.
````

---

## 12. Definition of done

- [ ] All five surfaces built and reachable
- [ ] `pnpm typecheck` and `pnpm lint` clean
- [ ] Unit, integration, permission and E2E tests from §10 passing
- [ ] Empty, loading, error and permission-denied states on every surface
- [ ] Verified at 1440px **and** 390px
- [ ] Keyboard-only operation on the office surfaces
- [ ] **4-room villa measured offline on a real Android**, browser closed and reopened, fully synced
- [ ] Every §9 budget measured on-device and met
- [ ] Conflict path demonstrated end to end
- [ ] Swapping the stubbed engine for a real one requires no changes to this module

---

## 13. Three things to remember while building this

1. **The photo must never block a save.** The instinct is to require evidence. Resist it. A camera that hangs in a basement godown must not cost the executive a re-visit — and that single decision determines whether they use the app or go back to the notebook.

2. **The live calculation is the moment the product earns its price.** Everything else in this module is a form. Sub-100ms, with the warning line rendered beneath in language a client could read. Get that one interaction right and the rest is forgivable.

3. **Test it in a real godown, on a real cheap phone, with mobile data switched off.** Every offline system works in DevTools. The one that matters is the one used standing in a half-built villa in Saibaba Colony with one bar of signal and dusty hands.
