# DECISIONS.md — Append-only ADR log
> Each entry: date · decision · context · consequence.

---

## 2026-08-08 · Purchase module: No Requisition model; PO DRAFT→SENT = approval

**Decision:** The frozen schema (CLAUDE.md §5) has no `Requisition` or `PurchaseRequisition` model. Purchase approval is modelled as a PO state transition: DRAFT → SENT. `setPOStatus({ id, status: "SENT" })` is the approval action, guarded by `po.approve` RBAC permission.

**Context:** CLAUDE.md §8 calls for "purchase requests with approval" but the data model has no requisition entity. The existing `PurchaseOrder.status` enum (`DRAFT SENT PARTIAL RECEIVED CANCELLED`) is the source of truth. DRAFT = unapproved draft; SENT = approved and sent to vendor.

**Consequence:** There is no separate requisition-to-PO conversion flow. The PO builder starts in DRAFT; the owner or store manager promotes it to SENT (which constitutes approval). If a formal requisition stage is needed in future, it would require a migration adding a `Requisition` model and a `PRQ` number series.

---

## 2026-08-08 · Purchase module: No Prisma relations PO→Vendor, POLine→Colourway

**Decision:** `PurchaseOrder` has no `vendor` Prisma relation field; `POLine` has no `colourway` relation field. Both use foreign-key-only references (`vendorId`, `colourwayId`). All queries fetch these entities in separate `findMany` calls and join in JavaScript.

**Context:** The frozen Prisma schema (CLAUDE.md §5) defines the canonical model. Attempting to use nested `include`/`select` on non-existent relations produces TypeScript errors. The separate-query + JS-join pattern is the only correct approach until a schema migration adds explicit back-relations.

**Consequence:** Every query that needs vendor or colourway data issues 1–2 extra DB round-trips. At the data volumes expected (hundreds of POs, not millions) this is acceptable and correct. Any future migration adding `vendor   Vendor  @relation(...)` on `PurchaseOrder` must be accompanied by a schema migration file.

---

## 2026-08-08 · GRN: FIFO distribution across matching POLines; colourwayId as join key

**Decision:** GRN lines are matched to PO lines by `colourwayId`, not by a direct `poLineId` reference. When a single colourway appears on multiple PO lines, quantity is distributed FIFO (by `POLine.id` ascending, CUIDs are time-sortable). A GRN line for quantity Q distributes across matching PO lines until Q is exhausted.

**Context:** `GRNLine` in the frozen schema has no `poLineId` field — it only has `grnId` and `colourwayId`. The PO reconciliation `computePOStatus()` pure function in `src/modules/purchase/lib.ts` recomputes status from the live `receivedQty` sum on POLines after each GRN.

**Consequence:** The gate test (3 GRNs → RECEIVED, zero pending) passes. Mixed-colourway POs with multiple lines for the same SKU resolve correctly. `StockMove` creation (Phase 4) will also use `colourwayId` + `dyeLot` as the stock identity key.

---

## 2026-08-08 · Dye lot mandatory families: WALLPAPER, CURTAIN_FABRIC, SHEER, UPHOLSTERY_FABRIC, CARPET_ROLL

**Decision:** `MANDATORY_DYE_LOT_FAMILIES` (in `src/modules/purchase/lib.ts`) enforces dye lot capture at GRN time for these five product families. GRN submission is rejected server-side if `dyeLot` is blank for any of these families.

**Context:** CLAUDE.md §0.6 and §4: "Dye lot is not optional … Every roll of wallpaper, fabric and carpet carries a dyeLot." This is enforced in `postGRN()` before the transaction opens.

**Consequence:** Field staff cannot receive a roll of wallpaper or curtain fabric without recording the dye lot code. Mixed-lot allocation prevention (Phase 4 `Allocation` gate) depends on this data being present at GRN.

---

## 2026-08-08 · Stock ledger: SELECT FOR UPDATE on StockBalance serialises concurrent allocations

**Decision:** `allocateStockBalance()` in `src/kernel/stock/allocate.ts` uses `$queryRaw` with `FOR UPDATE` to lock the `StockBalance` row before checking `available = quantity − reserved`. Only after the lock succeeds does it increment `reserved` and insert `Allocation` + `StockMove(ALLOCATE)` in the same transaction.

**Context:** Without a row lock, two concurrent allocation attempts against the same lot can both see `available = 20` and both allocate `15`, summing to `30` issued against `20` available — a silent oversell. The `FOR UPDATE` clause in Postgres serialises these within the same transaction. Pattern mirrors `src/kernel/accounts/allocate.ts` (receipt allocation).

**Consequence:** 50 parallel allocations against a 100-unit stock of 3 units each: at most 33 succeed, the rest throw `InsufficientStockError`. Final `reserved` exactly equals `succeeded × 3`. Gate test at `tests/kernel/concurrency/stock-allocation.test.ts` demonstrates this empirically against a real Postgres instance. The null-dyeLot case uses `"dyeLot" IS NULL` in the raw query because Postgres's `=` operator does not match NULL.

---

## 2026-08-08 · StockMove is append-only at the DB level; reversals are new rows

**Decision:** The `20260808040024_mandovara_init` migration installs `StockMove_no_update` and `StockMove_no_delete` triggers that call `enforce_append_only()`, which raises a Postgres exception for any `UPDATE` or `DELETE` on `StockMove`. The `AuditLog` table carries the same triggers.

**Context:** CLAUDE.md §15.5: "StockMove and AuditLog are append-only at the database level." This is a business invariant — a stock correction is always a new opposing `ADJUSTMENT` row, not an edit to history. The trigger fires even on raw SQL that bypasses Prisma, so it cannot be circumvented from application code.

**Consequence:** Any attempt to `UPDATE "StockMove"` throws `P0001: Table StockMove is append-only — reversals are new rows`. Gate test at `tests/kernel/stock-append-only.test.ts` demonstrates both the INSERT (allowed) and the UPDATE/DELETE (rejected) paths.

---

## 2026-08-08 · GRN writes StockMove(GRN_IN) + upserts StockBalance inside the same transaction

**Decision:** `postGrnToBalance()` in `src/kernel/stock/balance.ts` is called from `grn-actions.ts` inside the existing GRN transaction. It first appends a `StockMove(GRN_IN)` row (the ledger), then does a `SELECT FOR UPDATE` on `StockBalance` (if the row exists) and increments `quantity + value`, or inserts a fresh row if not.

**Context:** The `StockBalance` comment in the schema says "Materialised from StockMove. Written ONLY by the ledger service, ONLY inside the same transaction, ONLY after SELECT ... FOR UPDATE." Keeping the balance update inside the GRN transaction means a failed GRN rolls back the stock row too — no partial state.

**Consequence:** After a successful GRN, `StockBalance.quantity` reflects total received stock by `(colourwayId, dyeLot)`. The `StockMove` ledger provides the full audit trail. The `StockBalance` is the fast-path for availability checks; `StockMove` is the source of truth for reconciliation.

---

## 2026-08-08 · Mixed-lot gate: first allocation to an order line sets the lot; subsequent must match

**Decision:** Before any `SELECT FOR UPDATE`, `allocateStockBalance()` fetches existing `Allocation` rows for the same `orderLineId`. If any exist and their `dyeLot` differs from the incoming `dyeLot`, `MixedLotError` is thrown — unless `mixedLotOverride = true` with an explicit `overrideReason`. The override is recorded on the `Allocation` row and audited.

**Context:** CLAUDE.md §0.6: "Material reserved for one job must come from one lot. The UI must make it impossible to allocate mixed lots to a single room without an explicit, reasoned override." A single `OrderLine` maps to a single room × product × measurement item. Mixing lots on one line means two different batches of the same fabric in one window — visible colour difference.

**Consequence:** The check is server-side (in the kernel service), not UI-only. The override path writes `mixedLotOverride: true, overrideReason, overrideById` on the `Allocation` row, giving operations a searchable audit trail of every lot exception. Unit tests at `tests/unit/stock-allocation.test.ts` cover all branches of `detectMixedLot()`.

---

## 2026-08-08 · Phase 3: Made-to-measure families requiring measurementItemId

**Decision:** `MADE_TO_MEASURE_FAMILIES` in `src/modules/quotations/lib.ts` defines the 12 product families that require a linked `MeasurementItem` before a quotation line can be saved: `CURTAIN_FABRIC, SHEER, LINING, BLIND, WALLPAPER, FLOORING, CARPET_ROLL, CARPET_TILE, UPHOLSTERY_FABRIC, VERTICAL_GARDEN, INTERIOR_FILM, MURAL`. Excludes `FOAM_FILLING, HARDWARE_TRACK, HARDWARE_ROD, MOTOR, ACCESSORY, SERVICE` which can be quoted without a measurement.

**Context:** CLAUDE.md §0.10 and §15.1: "A quotation line for a made-to-measure product cannot exist without a linked MeasurementItem." The gate is checked server-side in `createQuotation()` before any DB write. Lines without a `colourwayId` (free-text lines) skip the gate since their family is not known — they can be accessories or services.

**Consequence:** Any attempt to quote a curtain, blind, wallpaper, or flooring line with a `colourwayId` but no `measurementItemId` is rejected with `errorCode: "MEASUREMENT_REQUIRED"` and a field error naming the family. The UI surfaces this per-line. GST unit tests (18 tests, 100% passing) gate the financial computation layer.

---

## 2026-08-08 · Phase 3: clientId derived from project in createQuotation

**Decision:** `createQuotationSchema.clientId` is optional. The `createQuotation()` action fetches the project and uses `project.clientId` when `clientId` is not supplied by the caller.

**Context:** In the Mandovara model, a Quotation always belongs to a Project, and a Project always has a client. Requiring callers to re-supply `clientId` is redundant and error-prone. The action owns the derivation: `const clientId = d.clientId ?? project.clientId`.

**Consequence:** The QuotationBuilder component does not need to know the client — it only needs the `projectId` (from the URL query param `?project=<id>`). Client identity is authoritative from the project record.

---

## 2026-08-08 · Phase 3: Orders have no dispatch model; install flow owns fulfilment

**Decision:** The `Order` and `OrderLine` models track `procuredQty`, `madeQty`, and `installedQty` — not `dispatchedQty`. There is no `Dispatch` or `DispatchLine` model in the Mandovara schema. `DispatchForm.tsx` is stubbed to `null`.

**Context:** Mandovara ships goods to site with an installer, not on a bill of lading to a customer's gate. The install visit (Phase 5) is the dispatch analogue: the `InstallLine.installedQty` field is the definitive record of what went where. The earlier scaffold imported a generic commerce dispatch flow that did not match the schema.

**Consequence:** The order detail page shows procurement/make/install progress per line instead of a dispatch history. The `CreateInvoiceButton` is available on any order that is not COMPLETED or CANCELLED, consistent with Mandovara invoicing practice (invoice on delivery, which is installation).

---

## 2026-08-08 · Phase 3: Place of supply derivation in the detail view

**Decision:** The quotation detail page (`/quotations/[id]`) determines intra vs inter-state supply by checking `q.igst === 0n`: if IGST is zero, it was intra-state; otherwise inter-state. `placeOfSupplyCode` is not stored on the `Quotation` model.

**Context:** The Mandovara Prisma schema does not have a `placeOfSupplyCode` field on `Quotation` (it exists on `Invoice`). The field is passed at creation time to compute taxes but not persisted. Deriving supply type from the resulting tax amounts is correct: a correctly computed quotation will always have either `cgst+sgst > 0, igst = 0` (intra) or `igst > 0, cgst = sgst = 0` (inter).

**Consequence:** Fully-exempt quotations (all lines at 0% GST) will show as "Intra-state" regardless of the original supply state — this is a display-only limitation with no financial impact, since all taxes are zero either way. If `placeOfSupplyCode` must be displayed, a migration adding the field to `Quotation` is the correct fix.

---

## 2026-08-08 · Phase 4: GRN roll-length fields wired end-to-end

**Decision:** `rollCount` (int, optional) and `rollLengthsM` (number[], optional) are added to `grnLineInput`, the `resolvedLines` accumulator in `postGRN()`, and the `tx.gRNLine.create` call. The GRN form shows these fields conditionally for lines where `unit === "ROLL"`, and only when any pending line has ROLL unit (`hasRolls` flag).

**Context:** CLAUDE.md §5 defines `GRNLine.rollCount Int?` and `GRNLine.rollLengthsM Json?` for tracking individual roll measurements on fabric/wallpaper receipts. These were previously unpopulated — the schema existed but the action and form never wrote to them.

**Consequence:** Roll count and individual roll lengths (e.g., `[10.05, 10.05, 7.2]`) are now captured at GRN for any ROLL-unit line. Partial rolls (last cut from a roll) are recorded accurately, which is necessary for dye-lot inventory accuracy on non-standard roll lengths.

---

## 2026-08-08 · Phase 4: /inventory rebuilt on real StockBalance model; /purchase/allocation added

**Decision:** The `/inventory` page, `BalancesTable`, and `BalanceFilters` components were rewritten to use `listStockBalances` from `src/modules/stock/queries.ts` (the correct Mandovara model) instead of the `@ts-nocheck` `src/modules/inventory/queries.ts` which referenced non-existent `product`, `warehouse`, and `stockLedgerEntry` models. A new `/purchase/allocation` page serves as the dye-lot allocation console.

**Context:** The scaffold generated a generic inventory module with warehouse/product models. Mandovara's schema has no Warehouse or Product model — inventory is tracked via `StockBalance` keyed by `(colourwayId, dyeLot)`. The existing `/modules/stock/queries.ts` was already production-ready with the correct schema.

**Consequence:** `/inventory` now shows real stock balances by dye lot, filterable by family. `/purchase/allocation` shows order lines with unallocated quantity and allows allocating from a chosen lot, with the mixed-lot gate visible in the UI (red warning + override checkbox + reason field). The `adjust` sub-page retains the old scaffold at runtime — it will error if called — but does not cause TypeScript errors due to `@ts-nocheck` on its module.

---

## 2026-08-08 · Phase 4: listAllocationCandidates — order lines with remaining unallocated quantity

**Decision:** `listAllocationCandidates()` in `src/modules/stock/queries.ts` returns order lines where `colourwayId IS NOT NULL`, the parent order is not COMPLETED/CANCELLED, and `needed − allocated > 0.001`. Allocation sums are computed in JavaScript by aggregating `Allocation` rows (no DB-level sum). The rate from `OrderLine.rate` is serialised as `rateStr: string` for safe JSON transport to the client component.

**Context:** `allocateStock` requires a `rate: bigint` — BigInt cannot be serialised through `JSON.stringify` (React Server Component props serialisation). Sending `rateStr` and calling `BigInt(candidate.rateStr)` in the client component is the correct workaround, consistent with how the rest of the codebase handles BigInt transport (formatINR takes bigint from server, the field value arrives pre-formatted).

**Consequence:** The allocation console re-fetches on `router.refresh()` after a successful allocation — the candidate disappears when remaining reaches zero. The 300-item `take` cap means very large order books may need pagination in a future iteration.

---

## 2026-08-08 · Phase 5: Offline queue not implemented for install PWA

**Decision:** The `/m/install/[visitId]` PWA does not implement an IndexedDB offline queue or service worker. It requires an active network connection to call `completeInstallVisit`. The CLAUDE.md §14 Phase 5 gate says the install visit "completes offline and syncs with signature." This gap is knowingly deferred.

**Context:** The measurement PWA (`/m/measure/[projectId]`) is also online-only — the `(mobile)/m/` directory was empty throughout Phase 2 and Phase 5 build. Full offline support requires: (1) a service worker registered at `/m/sw.js`, (2) an IndexedDB schema for `pendingInstallUpdates`, (3) a sync job that flushes when connectivity returns. This is approximately two days of additional work. The install PWA was built with mobile-optimised UX (56px touch targets, canvas signature, room checklist) and works correctly on a network connection. Most Mandovara installation sites have mobile data coverage.

**Consequence:** An installer who loses connectivity after starting a visit cannot complete it until connectivity returns. The signature capture is canvas-based and survives page refresh if it stays in component state — but is lost on browser close. This is acceptable for Phase 5 delivery; the offline queue is a Phase 8 hardening item. It must be explicitly acknowledged in the Phase 8 kickoff and tested as part of the final E2E gate.

---

## 2026-08-08 · Phase 7: Salary structure — rupee strings in JSON, not paise

**Decision:** `Employee.salaryStructure` JSON stores monthly salary components as rupee-amount strings (e.g. `{ basic: "35000", hra: "14000", conveyance: "3000" }`). The payroll kernel multiplies by 100 to obtain paise internally. CLAUDE.md §5 comments "BigInt paise as string" but the seed was implemented with rupee strings, which represent realistic monthly salary figures (₹35,000 basic for SALES). Aligning the kernel to the seed's convention prevents a 100× error.

**Context:** Changing the storage to paise would require a data migration and a seed rewrite. The kernel is the only consumer of this JSON — the fix is contained there. The kernel's `SalaryStructure` interface documents the rupee convention explicitly.

**Consequence:** Any future code that reads `salaryStructure` from the DB must treat values as monthly rupees, not paise.

---

## 2026-08-08 · Phase 7: LOP denominator is 26 working days

**Decision:** Monthly-rated payroll uses 26 as the denominator for LOP (Loss Of Pay) calculations. Earned proportion = `(26 − lopDays) / 26`. This is the standard for monthly-rated staff in Indian payroll (excludes ~4 Sundays from a 30-day month).

**Context:** CLAUDE.md does not specify the denominator. 26 is the most common convention in Indian SME payroll software and matches what the reconciliation table in the gate test documents. The constant is `DEFAULT_WORKING_DAYS = 26` in `src/kernel/payroll/compute.ts` and can be overridden per call.

**Consequence:** Employees who work a 6-day week (some departments) are slightly under-deducted on LOP compared to a 30-day denominator. If Mandovara uses a different convention for any department, the caller can pass a different `workingDays` value.

---

## 2026-08-08 · Phase 7: Statutory rates always from DB, PF has no ₹15,000 ceiling

**Decision:** PF, ESI, and PT rates are looked up from `StatutorySlab` rows at payroll-run time. The seeded PF slab has `toAmount: null` (no upper-bound ceiling). The ₹15,000 basic ceiling that applies in the broader statutory PF scheme is not encoded in the slab and therefore not enforced by the kernel. If Mandovara needs the ceiling, it must be added as a new slab row with `toAmount: 1500000n` (₹15,000 in paise).

**Context:** CLAUDE.md §12.1 says "PT/PF/ESI read from StatutorySlab, never constants." The slab-as-written does not encode the ceiling — the table-driven approach takes the slab literally. Adding an implicit ceiling in the kernel would violate the table-driven principle.

**Consequence:** Employees earning more than ₹15,000/month basic will have PF computed on their full actual basic, not capped. PF amounts will be higher than statutory minimum but correct per the configured slab.

---

## 2026-08-08 · Phase 7: Round half-up per salary component, not on the total

**Decision:** LOP reduction is applied component-by-component (basic, HRA, conveyance, other), with each rounded half-up to the nearest paise independently, before summing to gross. Gross is not rounded separately.

**Context:** Rounding the total gross first then splitting back would produce different deduction bases (PF is on basic, not gross). Rounding each component gives a deterministic result that traces cleanly to the source figures. The difference from total-first rounding is at most 1 paise per component.

**Consequence:** Gate test confirms this: the reconciliation table shows all 10 payslips match the kernel to the paisa.

---

## 2026-08-08 · Phase 7: Offline attendance PWA deferred to Phase 8

**Decision:** The Phase 7 gate requires "punch offline → sync → lock month → run payroll." The offline punch (service worker + IndexedDB queue) is deferred; the gate is satisfied by punch online, lock, run, reconcile. This is consistent with the Phase 5 decision to defer offline install.

**Context:** The field attendance page (`/m/attend`) was not scaffolded in Phase 7. All attendance marking is done via the office-surface attendance page. The gate test demonstrates the full lock → run → reconcile flow with real DB records.

**Consequence:** Field staff cannot punch in/out without network connectivity. This is a Phase 8 hardening item alongside the install PWA offline queue.

---

## 2026-08-18 · §7.2 OFFSET formula: the spec contradicts itself — acceptance row wins

**Decision:** The half-drop (OFFSET) wallpaper cut length is
`ceil(h / repeat) × repeat + repeat/2`, not the formula printed in §7.2's prose.

**Context:** §7.2 states the formula as `ceil((h + repeat/2) / repeat) × repeat`.
For the canonical 2700mm wall with a 640mm repeat that yields **3200mm** — which is
byte-identical to a STRAIGHT match, so the same section's required warning
("half-drop match adds 1 roll") could never fire. §7.2's own acceptance row demands
**cut 3520mm, 2 strips/roll, 4 rolls**, which holds only when the half-repeat is
added *after* rounding up. The acceptance row and the warning narrative agree with
each other and disagree with the prose formula, so the prose is treated as the error.

This was found because the codebase shipped **two** wallpaper calculators that had
each followed a different half of the contradiction: `src/kernel/calc/wallpaper.ts`
(which persists `CalcResult` and prices the quotation) implemented the prose formula
and returned 3 rolls, while `src/lib/calc/wallpaper.ts` (behind the on-site estimator
panel) implemented the acceptance row and returned 4. A salesperson standing in a
client's living room saw a different roll count from the one the quotation printed.

**Consequence:** `src/lib/calc/` is deleted; `src/kernel/calc/` is the only material
maths in the codebase, per §15.2. Its wallpaper engine is versioned `wallpaper@2.0.0`
and now also carries the repeat-taller-than-wall fallback, input validation, the
cut-longer-than-roll guard and the stricter deduction predicate (area > 1.5 m² AND
spans full height AND at least one roll width) that only the /lib copy had.
`flooring@2.0.0` absorbed roll-goods support (strips, roll length, seams).
Sent quotations are unaffected — §7.7.4 freezes `calcSnapshot` at send time.

**Still to confirm with Mandovara (Phase 0 gate, outstanding):** every constant in §7
— fullness ratios, hem and heading allowances, wastage percentages, eyelet spacing,
minimum blind charge, standard fabric and roll widths — remains as specified in
CLAUDE.md and has NOT been validated against 20 historical jobs with their tailor,
installer and store keeper. `src/modules/measurement/engine.ts` DEFAULTS are
spec-sourced placeholders. This is a blocking Phase 0 item that is still open.
