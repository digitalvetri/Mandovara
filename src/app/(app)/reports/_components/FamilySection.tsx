import type { FamilyMarginRow } from "@/modules/reports/family";
import { formatINR } from "@/kernel/money/format";

const FAMILY_LABEL: Record<string, string> = {
  CURTAIN_FABRIC:    "Curtain Fabric",
  SHEER:             "Sheer",
  LINING:            "Lining",
  BLIND:             "Blinds",
  WALLPAPER:         "Wallpaper",
  FLOORING:          "Flooring",
  CARPET_ROLL:       "Carpet (Roll)",
  CARPET_TILE:       "Carpet (Tile)",
  UPHOLSTERY_FABRIC: "Upholstery",
  VERTICAL_GARDEN:   "Vertical Garden",
  INTERIOR_FILM:     "Interior Film",
  MURAL:             "Artistical Works",
  SERVICE:           "Service / Labour",
  HARDWARE_TRACK:    "Hardware – Track",
  HARDWARE_ROD:      "Hardware – Rod",
  MOTOR:             "Motor",
  ACCESSORY:         "Accessory",
};

export function FamilySection({ rows }: { rows: FamilyMarginRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-[12px] text-text-faint">
        No invoice data — family margins appear once orders are invoiced.
      </div>
    );
  }

  const maxRev = rows.reduce((m, r) => r.revenue > m ? r.revenue : m, 0n);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule/60">
            <th className="py-2 text-left font-medium text-text-dim pr-4 w-[180px]">Family</th>
            <th className="py-2 text-left font-medium text-text-dim pr-4 hidden md:table-cell">Share</th>
            <th className="py-2 text-right font-medium text-text-dim pr-4">Revenue</th>
            <th className="py-2 text-right font-medium text-text-dim pr-4">COGS</th>
            <th className="py-2 text-right font-medium text-text-dim pr-4">Margin</th>
            <th className="py-2 text-right font-medium text-text-dim w-[60px]">Margin%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/40">
          {rows.map((r) => {
            const pos = r.margin >= 0n;
            const pct = parseFloat(r.marginPct || "0");
            const barW = maxRev > 0n ? Number((r.revenue * 100n) / maxRev) : 0;
            return (
              <tr key={r.family} className="group hover:bg-surface-hover/50 transition-colors">
                <td className="py-2 pr-4 text-text">
                  {FAMILY_LABEL[r.family] ?? r.family.replace(/_/g, " ")}
                </td>
                <td className="py-2 pr-4 hidden md:table-cell">
                  <div className="h-[5px] w-[100px] rounded-full bg-rule/40 overflow-hidden">
                    <div className="h-full bg-accent/60 rounded-full" style={{ width: `${barW}%` }} />
                  </div>
                </td>
                <td className="py-2 pr-4 text-right tabular text-text">{formatINR(r.revenue)}</td>
                <td className="py-2 pr-4 text-right tabular text-text-dim">{formatINR(r.cogs)}</td>
                <td className={`py-2 pr-4 text-right tabular ${pos ? "text-good" : "text-bad"}`}>
                  {formatINR(r.margin)}
                </td>
                <td className={`py-2 text-right tabular ${pos ? "text-good" : "text-bad"}`}>
                  {r.marginPct ? `${pct.toFixed(1)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
