# Pending Stock Verification

**Created:** 21 August 2026  
**Status:** 20 items · 29 rolls + 4 hardware pieces = 33 units NOT yet imported  
**Action required:** Physical roll/item label inspection before these can enter the system.

Do not import any item in this list without first confirming the details below.
Imported stock must not be modified to accommodate these — they are added separately once confirmed.

---

## Section 1 — Mandovara Stock: Named collections not found in catalogue

The person who built the Excel sheet wrote a catalogue name in Column A, but no collection with that name (or any recognisable variant) exists in the Product Catalogue. Each item needs a brand confirmed so the correct collection can be created or matched.

| # | Collection (Excel) | Code | Qty | Proposed mapping | Pending reason | Confirm from roll label |
|---|---|---|---|---|---|---|
| 1 | FAITH | F7047 | 6 rolls | None — no match found | No FAITH collection in catalogue under any brand | Brand name · full collection name · roll width · pattern repeat |
| 2 | FAITH | F7016 | 1 roll | None | Same as above | Brand name · full collection name |
| 3 | FAITH | F7057 | 1 roll | None | Same as above | Brand name · full collection name |
| 4 | MODELICA | AMDL211122 | 3 rolls | Possibly Arham-distributed (code prefix `AMDL` = AM + design line) | No MODELICA collection in catalogue | Brand name on selvedge · whether `AMDL` is the brand code or design line code |
| 5 | MODELICA | AMDL211125 | 3 rolls | Possibly Arham-distributed | Same as above | Brand name on selvedge |
| 6 | F&F | HOR809 | 2 rolls | None — no F&F brand or collection found | Unclear what "F&F" stands for; two codes with different prefixes (HOR vs DE) may be different sub-lines | Full brand name · whether HOR809 and DE214102 are from the same collection |
| 7 | F&F | DE214102 | 1 roll | None | Same as above | Full brand name · collection name |
| 8 | OKHILLA | RD3137 | 1 roll | None — no OKHILLA collection found | Unique code prefix `RD`; brand unknown | Brand name · full collection name · roll width |
| 9 | PASSENGER | TP21202 | 3 rolls | None — no PASSENGER collection found | Code prefix `TP` does not match any existing collection | Brand name · full collection name |
| 10 | BEYOND | 72008-4 | 1 roll | None — no BEYOND collection found | Numerical code format with suffix, similar to BRAHMOS but not matched | Brand name · whether this is a Latest Wallpaper / Arham distributed product |

**Subtotal:** 10 rows · 22 rolls

---

## Section 2 — Mandovara Stock: Unknown catalogue (listed as "–" in Excel)

The person who built the Excel sheet left Column A blank or entered "–", meaning the collection is not known. These rolls are in the showroom but nobody recorded which brand or collection they belong to.

| # | Code | Qty | Code pattern notes | Confirm from roll label |
|---|---|---|---|---|
| 11 | TN83405 | 1 roll | `TN` prefix — unrecognised | Brand name · collection name · roll width · pattern repeat |
| 12 | NO:0044 | 1 roll | Unusual `:` separator — possibly a European or Korean brand format | Brand name · collection name |
| 13 | EAR301 | 1 roll | Short `EAR` prefix | Brand name · collection name |
| 14 | AD138303 | 1 roll | `AD` prefix | Brand name · collection name |
| 15 | 386-508-47823 | 1 roll | Long numerical — may be a barcode, not a design code | Check if barcode or design code; scan label for brand name |
| 16 | 8603-2 | 1 roll | `NNNN-N` format identical to BRAHMOS codes — may be a Latest Wallpaper product | Check selvedge for "Latest Wallpaper" or "Brahmos" branding |
| 17 | 7252-1 | 1 roll | `NNNN-N` format identical to BRAHMOS codes | Check selvedge for "Latest Wallpaper" or "Brahmos" branding |

**Note on items 16 and 17:** The `NNNN-N` format matches the BRAHMOS stock already imported (e.g. `2101-1`). If the roll label confirms these are Latest Wallpaper / BRAHMOS products, they can be added to the existing `Ready Stock | BRAHMOS` collection without creating new catalogue entries.

**Subtotal:** 7 rows · 7 rolls

---

## Section 3 — Mandovara Stock: Section B and C (deliberately excluded)

These were excluded from the original import because they have no product code or are bespoke commissioned pieces. They are listed here for completeness.

| # | Description | Qty | Reason excluded |
|---|---|---|---|
| B1 | GREY COLOUR (DARK) — no code | 1 roll | Section B: colour-only stock, no design code, cannot be created as a catalogue SKU |
| B2 | SANDEL COLOUR — no code | 1 roll | Section B: colour-only stock, no design code |
| B3 | GREY COLOUR (LIGHT) — no code | 1 roll | Section B: colour-only stock, no design code |
| C1 | AL259719-A — LEAF DESIGN | 1 roll | Section C: customised / bespoke; code is a project reference, not a catalogue design |
| C2 | AL276246-A — TEMPLE DESIGN | 1 roll | Section C: customised / bespoke; code is a project reference |

**Action for Section B:** These rolls can only be imported if assigned to an existing catalogue colourway (e.g. a plain grey wallpaper already in the catalogue). Check the roll label for a brand code.  
**Action for Section C:** These are project-specific rolls. They belong on the relevant project's Order or Install record, not in general stock. Check which client project each belongs to.

**Subtotal:** 5 rows · 5 rolls *(not counted in the 33-unit total above as they require a different workflow)*

---

## Section 4 — Track Stock: Hardware items pending family confirmation

These two items were excluded from the TRACK STOCK import on 21 August 2026 because their product family is ambiguous. All other 28 track/rod/motor SKUs (43 pieces) were successfully imported as GRN MDV/GRN-2608-0004.

| # | Item (Excel) | Length | Qty | Pending reason | Confirm |
|---|---|---|---|---|---|
| 18 | PLYWOOD | No length | 2 pcs | Raw material (plywood board used as Roman blind header backing). Not a standard catalogue SKU. Unclear whether to track as `HARDWARE_TRACK` stock item or exclude from the stock module. | Confirm: should these boards be tracked as stock, or are they consumed during installation and expensed? If tracked: assign to `HARDWARE_TRACK` (Curtain Tracks). If expensed: no import needed. |
| 19 | ANTICRAFF | 32 in / 812.80 mm | 1 pc | Spelling unclear — may be "Anticraft" (brand), "Anti-corrosion" (finish), or a decorative rod type. Could be `HARDWARE_TRACK` or `HARDWARE_ROD`. | Check the item's physical label or the supplier invoice. If it has a pole/rod shape → `HARDWARE_ROD` (Curtain Rods). If it is a channel rail → `HARDWARE_TRACK` (Curtain Tracks). |
| 20 | ANTICRAFF | 33 in / 838.20 mm | 1 pc | Same as above | Same as above |

**Subtotal:** 3 rows · 4 pieces

---

## Summary

| Source | Pending rows | Pending units | Status |
|---|---|---|---|
| Mandovara Stock — named, no catalogue match | 10 | 22 rolls | Awaiting brand confirmation + catalogue entry |
| Mandovara Stock — no catalogue name | 7 | 7 rolls | Awaiting physical roll label inspection |
| Mandovara Stock — Section B (no code) | 3 | 3 rolls | Awaiting catalogue match or write-off decision |
| Mandovara Stock — Section C (customised) | 2 | 2 rolls | Awaiting project assignment |
| Track Stock — family ambiguous | 3 | 4 pcs | Awaiting confirmation of HARDWARE_TRACK vs HARDWARE_ROD vs expense |
| **Total pending (excl. Sec B/C)** | **20** | **33 units** | |

---

## How to resolve each item

1. **Inspect the physical roll label.** Every quality wallpaper roll carries a selvedge print showing the brand name, collection name, design code, colourway, roll width and batch/dye lot.
2. **For named-but-unmatched items** (Section 1): once the brand is confirmed, create the collection in the Product Catalogue under that brand, then re-run `pnpm tsx scripts/import-mandovara-stock.ts`. The script is idempotent and will pick up any new COLLECTION_MAP entries automatically — existing imported rows will not be duplicated.
3. **For unknown-code items** (Section 2): once the brand and collection are identified, add the roll to the correct section of the MANDOVARA STOCK sheet with the confirmed catalogue name, then re-run the import script.
4. **For ANTICRAFF** (Section 4): update `scripts/import-track-stock.ts` with the confirmed family and re-run. The GRN idempotency guard will skip the already-imported 28 rows and only add the new ones.
5. **For PLYWOOD** (Section 4): if confirmed as a stock item, add it to `import-track-stock.ts`. If it is expensed on installation, log it as a `ProjectExpense` on the relevant project instead.
