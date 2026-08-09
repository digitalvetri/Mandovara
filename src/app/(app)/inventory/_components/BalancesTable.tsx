import type { StockBalanceRow } from "@/modules/stock/queries";

const FAMILY_LABEL: Record<string, string> = {
  CURTAIN_FABRIC: "Curtain", SHEER: "Sheer", LINING: "Lining", BLIND: "Blind",
  WALLPAPER: "Wallpaper", FLOORING: "Flooring", CARPET_ROLL: "Carpet roll",
  CARPET_TILE: "Carpet tile", UPHOLSTERY_FABRIC: "Upholstery", FOAM_FILLING: "Foam",
  VERTICAL_GARDEN: "V. Garden", INTERIOR_FILM: "Film", MURAL: "Mural",
  HARDWARE_TRACK: "Track", HARDWARE_ROD: "Rod", MOTOR: "Motor",
  ACCESSORY: "Accessory", SERVICE: "Service",
};

export function BalancesTable({
  rows,
  canSeeValue: _canSeeValue,
}: {
  rows: StockBalanceRow[];
  canSeeValue: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No stock in this view.</div>
        <p className="text-[12px] text-text-muted">
          Post a GRN to receive stock. Dye lot and available quantity appear here once goods are received.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
            <Th>Colourway</Th>
            <Th>Family</Th>
            <Th>Dye lot</Th>
            <Th>Bin</Th>
            <Th align="right">On hand</Th>
            <Th align="right">Reserved</Th>
            <Th align="right">Available</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const avail = parseFloat(r.available);
            const reserved = parseFloat(r.reserved);
            return (
              <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                <Td>
                  <div className="tabular text-text-muted text-[11.5px]">{r.designCode}</div>
                  <div className="text-text">{r.colourwayCode}</div>
                  <div className="text-[11px] text-text-muted">{r.colourName}</div>
                </Td>
                <Td>
                  <span className="text-text-muted">{FAMILY_LABEL[r.family] ?? r.family}</span>
                </Td>
                <Td>
                  {r.dyeLot ? (
                    <span className="inline-block px-2 py-0.5 rounded-[4px] bg-gold-tint text-gold font-data text-[11px] uppercase tracking-wide">
                      {r.dyeLot}
                    </span>
                  ) : (
                    <span className="text-text-subtle text-[11.5px]">—</span>
                  )}
                </Td>
                <Td>
                  <span className="text-text-muted text-[11.5px]">{r.binLocation ?? "—"}</span>
                </Td>
                <Td align="right">
                  <span className="tabular text-text">{trim(r.quantity)}</span>
                </Td>
                <Td align="right">
                  <span className={`tabular ${reserved > 0 ? "text-heat" : "text-text-subtle"}`}>
                    {reserved > 0 ? trim(r.reserved) : "—"}
                  </span>
                </Td>
                <Td align="right">
                  <span className={`tabular font-medium ${avail <= 0 ? "text-fault" : "text-solid"}`}>
                    {trim(r.available)}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function trim(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}
function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"} align-top`}>
      {children}
    </td>
  );
}
