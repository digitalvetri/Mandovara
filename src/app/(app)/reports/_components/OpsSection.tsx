import type { DeadStockRow } from "@/modules/reports/deadstock";
import type { WastageRow } from "@/modules/reports/wastage";
import { formatINR } from "@/kernel/money/format";

export function DeadStockTable({ rows }: { rows: DeadStockRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] text-text-faint">
        No stock idle for 90+ days.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-rule/60">
            <th className="py-2 text-left font-medium text-text-dim pr-3">Design</th>
            <th className="py-2 text-left font-medium text-text-dim pr-3 hidden sm:table-cell">Lot</th>
            <th className="py-2 text-right font-medium text-text-dim pr-3">Avail.</th>
            <th className="py-2 text-right font-medium text-text-dim pr-3">Value</th>
            <th className="py-2 text-right font-medium text-text-dim">Days</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/40">
          {rows.map((r) => (
            <tr key={`${r.sku}-${r.dyeLot}`} className="hover:bg-surface-hover/50 transition-colors">
              <td className="py-1.5 pr-3">
                <div className="text-text leading-tight">{r.designName}</div>
                <div className="text-text-dim text-[11px]">{r.brandName} · {r.colourName}</div>
              </td>
              <td className="py-1.5 pr-3 font-mono text-[11px] text-text-dim hidden sm:table-cell">
                {r.dyeLot}
              </td>
              <td className="py-1.5 pr-3 text-right tabular text-text">{r.available}</td>
              <td className="py-1.5 pr-3 text-right tabular text-text">
                {formatINR(BigInt(r.valueStr))}
              </td>
              <td className={`py-1.5 text-right tabular ${r.lastMovedDays > 180 ? "text-bad" : "text-heat"}`}>
                {r.lastMovedDays}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WastageTable({ rows }: { rows: WastageRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] text-text-faint">
        No make-job wastage data yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-rule/60">
            <th className="py-2 text-left font-medium text-text-dim pr-3">Tailor</th>
            <th className="py-2 text-right font-medium text-text-dim pr-3 w-[48px]">Jobs</th>
            <th className="py-2 text-right font-medium text-text-dim pr-3">Issued (m)</th>
            <th className="py-2 text-right font-medium text-text-dim pr-3">Wasted (m)</th>
            <th className="py-2 text-right font-medium text-text-dim">Wastage%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/40">
          {rows.map((r) => {
            const pct = parseFloat(r.wastagePct || "0");
            const high = pct > 8;
            return (
              <tr key={r.employeeId} className="hover:bg-surface-hover/50 transition-colors">
                <td className="py-1.5 pr-3 text-text">{r.employeeName}</td>
                <td className="py-1.5 pr-3 text-right tabular text-text-dim">{r.jobCount}</td>
                <td className="py-1.5 pr-3 text-right tabular text-text">{parseFloat(r.issuedM).toFixed(2)}</td>
                <td className="py-1.5 pr-3 text-right tabular text-text-dim">{parseFloat(r.wastedM).toFixed(2)}</td>
                <td className={`py-1.5 text-right tabular ${high ? "text-bad" : "text-text"}`}>
                  {r.wastagePct ? `${pct.toFixed(1)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
