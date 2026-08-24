// Table components and shared PDF helpers extracted from QuotePdf.tsx (§10 300-line limit).
// Exports: fm, specFromSnapshot, TH, RoomHeader, TR, SigBlock.

import { View, Text } from "@react-pdf/renderer";
import type { QuotationLine } from "@/modules/quotations/queries";
import { pdfStyles as s, WHITE, INK, MUTED, STRIP, BRAND, RULE } from "./_pdf-styles";

const UNIT: Record<string, string> = {
  METRE: "m", ROLL: "roll", SQFT: "sqft", SQM: "sqm",
  PIECE: "pc", SET: "set", BOX: "box", RUNNING_FT: "rft",
};

export function fm(p: bigint): string {
  const neg = p < 0n;
  const a   = neg ? -p : p;
  const raw = (a / 100n).toString();
  const grp = raw.length <= 3 ? raw
    : raw.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + raw.slice(-3);
  return neg ? `(₹${grp})` : `₹${grp}`;
}

// Build a concise spec line from a frozen CalcResult snapshot.
export function specFromSnapshot(snap: Record<string, unknown> | null, w?: string | null, h?: string | null): string | null {
  const parts: string[] = [];
  if (w && h) parts.push(`${w} × ${h} mm`);
  if (!snap) return parts.length ? parts.join(" · ") : null;
  if (snap["materialQty"] && snap["materialUnit"]) {
    const u = UNIT[snap["materialUnit"] as string] ?? String(snap["materialUnit"]).toLowerCase();
    parts.push(`${snap["materialQty"]} ${u}`);
  }
  if (snap["widthsRequired"]) parts.push(`${snap["widthsRequired"]} widths`);
  if (snap["rollsRequired"]) parts.push(`${snap["rollsRequired"]} rolls`);
  if (snap["boxesRequired"]) parts.push(`${snap["boxesRequired"]} boxes`);
  if (snap["areaSqft"]) parts.push(`${snap["areaSqft"]} sqft`);
  const warns = snap["warnings"] as string[] | undefined;
  if (warns?.[0]) parts.push(warns[0]);
  return parts.length ? parts.join(" · ") : null;
}

// ── Table header ──────────────────────────────────────────────────────────────
export function TH({ fixed: fx }: { fixed?: boolean }) {
  return (
    <View style={s.thead} fixed={fx}>
      <View style={s.cSwt} />
      <View style={s.cNo}><Text style={[s.th, { textAlign: "center" }]}>#</Text></View>
      <View style={s.cDesc}><Text style={s.th}>DESCRIPTION</Text></View>
      <View style={s.cQtyU}><Text style={[s.th, { textAlign: "right" }]}>QTY</Text></View>
      <View style={s.cRate}><Text style={[s.th, { textAlign: "right" }]}>RATE (₹)</Text></View>
      <View style={s.cHsn}><Text style={s.th}>HSN</Text></View>
      <View style={s.cGst}><Text style={[s.th, { textAlign: "right" }]}>GST</Text></View>
      <View style={s.cAmt}><Text style={[s.th, { textAlign: "right" }]}>AMOUNT (₹)</Text></View>
    </View>
  );
}

// ── Room group header ─────────────────────────────────────────────────────────
export function RoomHeader({ label }: { label: string }) {
  return (
    <View style={s.roomHeader}>
      <Text style={s.roomHeaderText}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ── Signature block ───────────────────────────────────────────────────────────
export function SigBlock({ clientName, ownerName, phone }: { clientName: string; ownerName: string | null; phone: string }) {
  return (
    <View style={s.sigSection} wrap={false}>
      <View style={s.sigCol}>
        <Text style={s.sigLabel}>ACCEPTED BY (CLIENT)</Text>
        <View style={s.sigLine} />
        <Text style={s.sigName}>{clientName}</Text>
        <Text style={s.sigRole}>Signature &amp; date</Text>
      </View>
      <View style={s.sigCol}>
        <Text style={s.sigLabel}>PREPARED BY</Text>
        <View style={s.sigLine} />
        <Text style={s.sigName}>{ownerName ?? "Mandovara"}</Text>
        <Text style={s.sigRole}>Mandovara Interiors · {phone}</Text>
      </View>
      <View style={s.sigCol}>
        <Text style={s.sigLabel}>AUTHORISED SIGNATORY</Text>
        <View style={s.sigLine} />
        <Text style={s.sigName}>For Mandovara</Text>
        <Text style={s.sigRole}>Stamp &amp; signature</Text>
      </View>
    </View>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────
export function TR({ line: l, idx }: { line: QuotationLine; idx: number }) {
  const spec      = specFromSnapshot(l.calcSnapshot, l.widthMm, l.heightMm);
  const subLabel  = [l.brandName, l.designName, l.colourwayCode].filter(Boolean).join(" · ");
  const swatchClr = l.colourHex ?? STRIP;
  const hasSwatch = !!l.colourHex;

  return (
    <View style={[s.tr, { backgroundColor: idx % 2 === 1 ? STRIP : WHITE }]} wrap={false}>
      {/* Swatch dot */}
      <View style={[s.cSwt, { justifyContent: "flex-start", alignItems: "center", paddingTop: 11 }]}>
        {hasSwatch && (
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: swatchClr, borderWidth: 0.5, borderColor: RULE }} />
        )}
      </View>
      {/* # */}
      <View style={s.cNo}>
        <Text style={[s.tdMain, { textAlign: "center", color: MUTED }]}>{idx + 1}</Text>
      </View>
      {/* Description + brand/colourway sub-label + spec */}
      <View style={s.cDesc}>
        <Text style={s.tdMain}>{l.description || "—"}</Text>
        {subLabel ? <Text style={s.tdSub}>{subLabel}</Text> : null}
        {spec     ? <Text style={[s.tdSub, { color: BRAND }]}>{spec}</Text> : null}
        {l.isOptional ? <Text style={s.tdOpt}>Optional</Text> : null}
      </View>
      {/* Qty + Unit combined */}
      <View style={s.cQtyU}>
        <Text style={[s.tdRight, { color: INK }]}>
          {parseFloat(l.quantity)}{" "}{UNIT[l.unit] ?? l.unit.toLowerCase()}
        </Text>
      </View>
      {/* Rate */}
      <View style={s.cRate}>
        <Text style={[s.tdRight, { fontWeight: "bold" }]}>{fm(l.rate)}</Text>
      </View>
      {/* HSN */}
      <View style={s.cHsn}>
        <Text style={[s.tdMain, { color: MUTED, fontSize: 7 }]}>{l.hsn ?? "—"}</Text>
      </View>
      {/* GST % */}
      <View style={s.cGst}>
        <Text style={[s.tdRight, { color: MUTED }]}>{l.gstRate}%</Text>
      </View>
      {/* Taxable amount — FIXED: was l.amount (GST-inclusive), now l.taxable */}
      <View style={s.cAmt}>
        <Text style={[s.tdRight, { fontWeight: "bold", color: BRAND }]}>{fm(l.taxable)}</Text>
      </View>
    </View>
  );
}
