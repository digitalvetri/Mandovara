// Pure sub-components for the employee dashboard. Extracted from
// page.tsx to keep it under the CLAUDE.md §10 300-line ceiling.

export function MonthBar({ label, value, total, barColor, numColor }: {
  label: string; value: number; total: number; barColor: string; numColor: string;
}) {
  const pct = total === 0 ? 0 : Math.min((value / total) * 100, 100);
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-[12px] text-text-dim">{label}</span>
        <span className={`tabular-nums text-[13px] font-semibold ${value > 0 ? numColor : "text-text-faint"}`}>{value}</span>
      </div>
      <div className="h-[5px] rounded-full bg-rule overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function LeaveRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-text-dim">{label}</span>
      <span className={`tabular-nums text-[13px] font-semibold ${color}`}>{value}</span>
    </div>
  );
}
