// Table primitives for the quotation PDF (kept out of QuotePdf.tsx for
// CLAUDE.md §10's 300-line ceiling).
//
// Same five columns as before — ITEM | Unit | QTY | RATE | AMT — and the
// same four row shapes: header, item, group caption, and a figure row
// for the discount. Redesigned 2026-08-30: hairline horizontal rules
// instead of a box around every cell, alternating row tint for tracking
// across a wide row, and figures right-aligned so a column of money can
// be read down its last digit.
//
// The total is no longer a row here; QuotePdf sets it as its own block
// beneath the table.

import { View, Text } from "@react-pdf/renderer";
import { pdfStyles as s, COLS } from "./_pdf-styles";

/**
 * Money as the studio prints it: Indian grouping, no ₹ symbol, and paise
 * only when there are any — 27,475 · 7,500 · 33,281.25 · -8,743.75.
 */
export function amt(paise: bigint): string {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  const rupees = abs / 100n;
  const paisePart = abs % 100n;

  const raw = rupees.toString();
  const grouped = raw.length <= 3
    ? raw
    : raw.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + raw.slice(-3);

  const body = paisePart === 0n
    ? grouped
    : `${grouped}.${paisePart.toString().padStart(2, "0")}`;
  return neg ? `−${body}` : body;
}

/** Quantity without trailing noise: 25, not 25.00. */
export function qtyText(q: string): string {
  const n = Number(q);
  if (!Number.isFinite(n)) return q;
  return Number.isInteger(n) ? n.toString() : String(parseFloat(n.toFixed(2)));
}

/** ITEM | Unit | QTY | RATE | AMT — repeated on every page. */
export function TableHead() {
  return (
    <View style={s.head} fixed>
      <View style={[s.headCell, { width: COLS.item }]}><Text style={s.headText}>ITEM</Text></View>
      <View style={[s.headCell, { width: COLS.unit }]}><Text style={[s.headText, { textAlign: "center" }]}>UNIT</Text></View>
      <View style={[s.headCell, { width: COLS.qty  }]}><Text style={[s.headText, { textAlign: "right" }]}>QTY</Text></View>
      <View style={[s.headCell, { width: COLS.rate }]}><Text style={[s.headText, { textAlign: "right" }]}>RATE</Text></View>
      <View style={[s.headCell, { width: COLS.amt  }]}><Text style={[s.headText, { textAlign: "right" }]}>AMOUNT</Text></View>
    </View>
  );
}

/** One priced line. `alt` tints every other row for horizontal tracking. */
export function ItemRow({
  item, unit, quantity, rate, amount, alt,
}: {
  item: string; unit: string; quantity: string;
  rate: bigint; amount: bigint; alt?: boolean;
}) {
  return (
    <View style={[s.row, ...(alt ? [s.rowAlt] : [])]} wrap={false}>
      <View style={[s.cell, { width: COLS.item }]}><Text style={s.cellText}>{item}</Text></View>
      <View style={[s.cell, { width: COLS.unit }]}><Text style={s.cellMuted}>{unit}</Text></View>
      <View style={[s.cell, { width: COLS.qty  }]}><Text style={s.num}>{qtyText(quantity)}</Text></View>
      <View style={[s.cell, { width: COLS.rate }]}><Text style={s.num}>{amt(rate)}</Text></View>
      <View style={[s.cell, { width: COLS.amt  }]}><Text style={s.num}>{amt(amount)}</Text></View>
    </View>
  );
}

/** A room caption — a tinted band spanning the row, as the source groups. */
export function GroupRow({ label }: { label: string }) {
  return (
    <View style={s.groupRow} wrap={false}>
      <Text style={s.groupText}>{label}</Text>
    </View>
  );
}

/** Money coming off the total — the one place a second colour earns its keep. */
export function DeductionRow({ label, value }: { label: string; value: bigint }) {
  return (
    <View style={s.row} wrap={false}>
      <View style={[s.cell, { width: COLS.item }]}><Text style={s.deductLabel}>{label}</Text></View>
      <View style={[s.cell, { width: COLS.unit }]} />
      <View style={[s.cell, { width: COLS.qty  }]} />
      <View style={[s.cell, { width: COLS.rate }]} />
      <View style={[s.cell, { width: COLS.amt  }]}><Text style={s.deductNum}>{amt(value)}</Text></View>
    </View>
  );
}
