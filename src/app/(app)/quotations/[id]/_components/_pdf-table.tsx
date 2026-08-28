// Table primitives for the quotation PDF (kept out of QuotePdf.tsx for
// CLAUDE.md §10's 300-line ceiling).
//
// Five columns, matching the studio's own document exactly:
//
//   ITEM | Unit | QTY | RATE | AMT
//
// Everything is centred and hard-ruled in black, because that is what
// the source quotations look like. Rows come in four shapes: the header,
// an item, a group caption (a bare name like WALLPAPER with the numeric
// cells left empty), and a figure row (the discount and the total).

import { View, Text } from "@react-pdf/renderer";
import { pdfStyles as s, COLS } from "./_pdf-styles";

/**
 * Money as the source document prints it: grouped Indian-style, no ₹
 * symbol, and paise shown only when there are any — 27475, 7500,
 * 33281.25, -8743.75.
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
  return neg ? `-${body}` : body;
}

/** Quantity without trailing noise: 25, not 25.00. */
export function qtyText(q: string): string {
  const n = Number(q);
  if (!Number.isFinite(n)) return q;
  return Number.isInteger(n) ? n.toString() : String(parseFloat(n.toFixed(2)));
}

interface CellProps {
  width: string;
  children?: React.ReactNode;
  last?: boolean;
  noRule?: boolean;
}

function Cell({ width, children, last, noRule }: CellProps) {
  return (
    <View style={[s.cell, { width }, ...(last ? [s.cellLast] : []), ...(noRule ? [s.cellNoRule] : [])]}>
      {children}
    </View>
  );
}

/** ITEM | Unit | QTY | RATE | AMT — repeated on every page. */
export function TableHead() {
  return (
    <View style={s.row} fixed>
      <Cell width={COLS.item}><Text style={s.headText}>ITEM</Text></Cell>
      <Cell width={COLS.unit}><Text style={s.headText}>Unit</Text></Cell>
      <Cell width={COLS.qty}><Text style={s.headText}>QTY</Text></Cell>
      <Cell width={COLS.rate}><Text style={s.headText}>RATE</Text></Cell>
      <Cell width={COLS.amt} last><Text style={s.headText}>AMT</Text></Cell>
    </View>
  );
}

/** One priced line. */
export function ItemRow({
  item, unit, quantity, rate, amount,
}: {
  item: string; unit: string; quantity: string; rate: bigint; amount: bigint;
}) {
  return (
    <View style={s.row} wrap={false}>
      <Cell width={COLS.item}><Text style={s.cellTextItem}>{item}</Text></Cell>
      <Cell width={COLS.unit}><Text style={s.cellText}>{unit}</Text></Cell>
      <Cell width={COLS.qty}><Text style={s.cellText}>{qtyText(quantity)}</Text></Cell>
      <Cell width={COLS.rate}><Text style={s.cellText}>{amt(rate)}</Text></Cell>
      <Cell width={COLS.amt} last><Text style={s.cellText}>{amt(amount)}</Text></Cell>
    </View>
  );
}

/**
 * A caption row — a bare heading like WALLPAPER with the numeric cells
 * empty, exactly as the source groups its items.
 */
export function GroupRow({ label }: { label: string }) {
  return (
    <View style={s.row} wrap={false}>
      <Cell width={COLS.item}><Text style={s.groupText}>{label}</Text></Cell>
      <Cell width={COLS.unit} />
      <Cell width={COLS.qty} />
      <Cell width={COLS.rate} />
      <Cell width={COLS.amt} last />
    </View>
  );
}

/**
 * A red row carrying a label and a single figure — the discount line
 * ("LESS DIS. 25%") and TOTAL both take this shape in the original.
 */
export function FigureRow({
  label, value, last,
}: { label: string; value: bigint; last?: boolean }) {
  return (
    <View style={s.row} wrap={false}>
      <Cell width={COLS.item} noRule={last}><Text style={s.redBold}>{label}</Text></Cell>
      <Cell width={COLS.unit} noRule={last} />
      <Cell width={COLS.qty} noRule={last} />
      <Cell width={COLS.rate} noRule={last} />
      <Cell width={COLS.amt} last noRule={last}>
        <Text style={s.redBold}>{amt(value)}</Text>
      </Cell>
    </View>
  );
}

/** An empty spacer row — the source uses these to separate groups. */
export function SpacerRow() {
  return (
    <View style={s.row} wrap={false}>
      <Cell width={COLS.item} />
      <Cell width={COLS.unit} />
      <Cell width={COLS.qty} />
      <Cell width={COLS.rate} />
      <Cell width={COLS.amt} last />
    </View>
  );
}
