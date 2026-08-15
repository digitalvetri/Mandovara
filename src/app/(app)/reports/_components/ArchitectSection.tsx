import Link from "next/link";
import type { Route } from "next";
import type { ArchitectReportRow } from "@/modules/reports/architect";
import { formatINR } from "@/kernel/money/format";

export function ArchitectSection({ rows }: { rows: ArchitectReportRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-[12px] text-text-faint">
        No architect referrals recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule/60">
            <th className="py-2 text-left font-medium text-text-dim pr-4">Firm</th>
            <th className="py-2 text-left font-medium text-text-dim pr-4 hidden sm:table-cell">Contact</th>
            <th className="py-2 text-right font-medium text-text-dim pr-4 w-[60px]">Projects</th>
            <th className="py-2 text-right font-medium text-text-dim pr-4">Revenue</th>
            <th className="py-2 text-right font-medium text-text-dim pr-4 hidden lg:table-cell w-[60px]">Comm%</th>
            <th className="py-2 text-right font-medium text-text-dim pr-4">Comm. Total</th>
            <th className="py-2 text-right font-medium text-text-dim pr-4 hidden md:table-cell">Paid</th>
            <th className="py-2 text-right font-medium text-text-dim w-[110px]">Pending</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/40">
          {rows.map((a) => (
            <tr key={a.architectId} className="hover:bg-surface-hover/50 transition-colors">
              <td className="py-2 pr-4 font-medium text-text">
                <Link
                  href={`/clients?arch=${a.architectId}` as Route}
                  className="hover:text-accent transition-colors"
                >
                  {a.firmName}
                </Link>
              </td>
              <td className="py-2 pr-4 text-text-dim hidden sm:table-cell">
                {a.contactName}
              </td>
              <td className="py-2 pr-4 text-right tabular text-text-dim">{a.projectCount}</td>
              <td className="py-2 pr-4 text-right tabular text-text">{formatINR(a.revenue)}</td>
              <td className="py-2 pr-4 text-right tabular text-text-dim hidden lg:table-cell">
                {parseFloat(a.commissionPct).toFixed(1)}%
              </td>
              <td className="py-2 pr-4 text-right tabular text-text">{formatINR(a.commissionTotal)}</td>
              <td className="py-2 pr-4 text-right tabular text-good hidden md:table-cell">
                {formatINR(a.commissionPaid)}
              </td>
              <td className="py-2 text-right tabular">
                <span className={a.commissionPending > 0n ? "text-heat" : "text-text-dim"}>
                  {formatINR(a.commissionPending)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
