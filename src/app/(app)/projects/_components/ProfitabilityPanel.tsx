import { TrendingUp, TrendingDown } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { ProjectProfitability } from "@/modules/reports/profitability";

interface Props {
  data: ProjectProfitability;
}

export function ProfitabilityPanel({ data }: Props) {
  const positive   = data.grossMargin >= 0n;
  const pctNum     = data.grossMarginPct !== "" ? parseFloat(data.grossMarginPct) : null;
  const absMargin  = data.grossMargin < 0n ? -data.grossMargin : data.grossMargin;

  return (
    <div className="rounded-[12px] border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-muted">
          Project Profitability
        </span>
        {pctNum !== null && (
          <span
            className={`flex items-center gap-1 font-data text-[12px] font-semibold ${positive ? "text-solid" : "text-fault"}`}
          >
            {positive ? <TrendingUp size={13} strokeWidth={1.8} /> : <TrendingDown size={13} strokeWidth={1.8} />}
            {positive ? "+" : ""}{pctNum.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/40 text-[12px]">
        <ProfRow
          label={`Revenue (${data.invoiceCount} invoice${data.invoiceCount !== 1 ? "s" : ""}, ex-GST)`}
          value={formatINR(data.revenue)}
          colorClass="text-text"
        />
        <ProfRow
          label={`Material cost (${data.stockMoveCount} stock move${data.stockMoveCount !== 1 ? "s" : ""})`}
          value={`− ${formatINR(data.materialCogs)}`}
          colorClass="text-text-muted"
        />
        {data.expensesTotal > 0n && (
          <ProfRow
            label={`Project expenses (${data.expenseCount} approved)`}
            value={`− ${formatINR(data.expensesTotal)}`}
            colorClass="text-text-muted"
          />
        )}
        {data.commissionTotal > 0n && (
          <ProfRow
            label="Architect commission"
            value={`− ${formatINR(data.commissionTotal)}`}
            colorClass="text-text-muted"
          />
        )}

        {/* Gross margin — accent row */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-2/40">
          <span className="font-semibold text-text">Gross margin</span>
          <span className={`font-data font-semibold text-[13px] ${positive ? "text-solid" : "text-fault"}`}>
            {positive ? "" : "− "}{formatINR(absMargin)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProfRow({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-text-muted">{label}</span>
      <span className={`font-data ${colorClass}`}>{value}</span>
    </div>
  );
}
