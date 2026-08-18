// Profile card primitives (§10 split).


export function Card({
  title, children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-surface overflow-hidden h-fit">
      <div className="px-5 py-3 border-b border-border/60">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {title}
        </span>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

export function FieldRow({
  icon, label, value, mono = false, muted = false, valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_2fr] items-center gap-3 px-5 py-3">
      {/* Icon */}
      <span className="text-text-subtle shrink-0">{icon}</span>
      {/* Label */}
      <span className="text-[12px] text-text-muted">{label}</span>
      {/* Value */}
      <span className={[
        "text-[13px] min-w-0 truncate text-right",
        mono ? "font-data text-[12px] text-text-subtle" : muted ? "text-text-muted italic" : "text-text",
        valueClass ?? "",
      ].join(" ")}>
        {value}
      </span>
    </div>
  );
}
