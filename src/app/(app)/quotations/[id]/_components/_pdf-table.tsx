// Table cells + row builders for the sample-style quotation PDF.
// Exports:  fm  (₹ formatter, no symbol — matches the samples which
// show plain numbers), TH  (5-column header), TR  (product line),
// SectionRow  (bare label row), DiscountRow, TotalRow.

import { View, Text } from "@react-pdf/renderer";
import type { QuotationLine } from "@/modules/quotations/queries";
import { pdfStyles as s } from "./_pdf-styles";

const UNIT_SHORT: Record<string, string> = {
  METRE: "MTR", ROLL: "ROLLS", SQFT: "SQFT", SQM: "SQM",
  PIECE: "NOS", SET: "SET", BOX: "BOX", RUNNING_FT: "RFT",
};

// Number formatter — matches the owner's sample PDFs, which show plain
// numbers with no ₹ symbol and no thousand separators (e.g. "27475",
// "33281.25"). Two decimals appear only when the paise fraction is
// non-zero so integers stay clean.
export function fm(paise: bigint): string {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  const whole = abs / 100n;
  const frac  = abs % 100n;
  const wholeStr = whole.toString();
  const out = frac === 0n
    ? wholeStr
    : `${wholeStr}.${frac.toString().padStart(2, "0")}`;
  return neg ? `-${out}` : out;
}

// ── Table header ──────────────────────────────────────────────────
export function TH({ fixed: fx }: { fixed?: boolean }) {
  return (
    <View style={s.thead} fixed={fx}>
      <View style={s.cItem}><Text style={[s.th]}>ITEM</Text></View>
      <View style={s.cUnit}><Text style={[s.th, s.thLbl]}>Unit</Text></View>
      <View style={s.cQty}><Text style={[s.th, s.thLbl]}>QTY</Text></View>
      <View style={s.cRate}><Text style={[s.th, s.thLbl]}>RATE</Text></View>
      <View style={s.cAmt}><Text style={[s.th, s.thLbl]}>AMT</Text></View>
    </View>
  );
}

// ── Bare-label section row ────────────────────────────────────────
// Used when a line has a roomLabel that changes — matches the sample's
// "WALLPAPER" row (label only, all numeric cells empty).
export function SectionRow({ label }: { label: string }) {
  return (
    <View style={s.trSection}>
      <View style={s.cItem}><Text style={s.tdSection}>{label.toUpperCase()}</Text></View>
      <View style={s.cUnit} />
      <View style={s.cQty} />
      <View style={s.cRate} />
      <View style={s.cAmt} />
    </View>
  );
}

// ── Product line ──────────────────────────────────────────────────
export function TR({ line: l }: { line: QuotationLine }) {
  // Sample-style AMT = rate × qty (pre-discount, pre-tax). Discount
  // is shown as a separate DiscountRow beneath. Pre-tax matches
  // what the customer sees in the sample bottom-line TOTAL.
  const qtyStr = l.quantity;
  const qtyNum = parseFloat(qtyStr);
  const grossPaise = (l.rate * BigInt(Math.round(qtyNum * 10_000))) / 10_000n;

  return (
    <View style={s.tr} wrap={false}>
      <View style={s.cItem}>
        <Text style={s.td}>{l.description || "—"}</Text>
      </View>
      <View style={s.cUnit}>
        <Text style={[s.td, s.tdCenter]}>{UNIT_SHORT[l.unit] ?? l.unit}</Text>
      </View>
      <View style={s.cQty}>
        <Text style={[s.td, s.tdCenter]}>{Number.isInteger(qtyNum) ? qtyNum : qtyStr}</Text>
      </View>
      <View style={s.cRate}>
        <Text style={[s.td, s.tdCenter]}>{fm(l.rate)}</Text>
      </View>
      <View style={s.cAmt}>
        <Text style={[s.td, s.tdRight]}>{fm(grossPaise)}</Text>
      </View>
    </View>
  );
}

// ── Discount row (line-level) ─────────────────────────────────────
// Rendered after a TR when the line's discountPct > 0. Matches the
// sample's "LESS DIS. 25% -8743.75" row.
export function DiscountRow({ line: l }: { line: QuotationLine }) {
  const pct = parseFloat(l.discountPct);
  if (!pct || pct <= 0) return null;
  const qtyNum = parseFloat(l.quantity);
  const grossPaise = (l.rate * BigInt(Math.round(qtyNum * 10_000))) / 10_000n;
  const discountPaise = (grossPaise * BigInt(Math.round(pct * 100))) / 10_000n;

  return (
    <View style={s.trDiscount} wrap={false}>
      <View style={s.cItem}>
        <Text style={s.tdDiscount}>LESS DIS. {Number.isInteger(pct) ? pct : pct.toFixed(2)}%</Text>
      </View>
      <View style={s.cUnit} />
      <View style={s.cQty} />
      <View style={s.cRate} />
      <View style={s.cAmt}>
        <Text style={[s.tdDiscount, s.tdRight]}>-{fm(discountPaise)}</Text>
      </View>
    </View>
  );
}

// ── TOTAL row ─────────────────────────────────────────────────────
export function TotalRow({ total }: { total: bigint }) {
  return (
    <View style={s.trTotal} wrap={false}>
      <View style={s.cItem}><Text style={s.tdTotal}>TOTAL</Text></View>
      <View style={s.cUnit} />
      <View style={s.cQty} />
      <View style={s.cRate} />
      <View style={s.cAmt}><Text style={[s.tdTotal, s.tdRight]}>{fm(total)}</Text></View>
    </View>
  );
}
