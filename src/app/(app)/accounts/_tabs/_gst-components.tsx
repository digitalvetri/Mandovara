// Sub-components for GstTab — extracted to keep GstTab under 300 lines.

export function NetCard({
  label, value, sub, tone, big,
}: { label: string; value: string; sub?: string; tone: "accent" | "solid" | "heat"; big?: boolean }) {
  const toneClass = tone === "accent" ? "text-accent" : tone === "solid" ? "text-solid" : "text-heat";
  return (
    <div className="rounded-[12px] border border-rule bg-surface p-4">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-1">{label}</div>
      <div className={`tabular font-semibold leading-none ${big ? "text-[26px]" : "text-[20px]"} ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[10.5px] text-text-dim tabular">{sub}</div>}
    </div>
  );
}

export function ComponentRow({
  label, output, input, net,
}: { label: string; output: string; input: string; net: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.10em] text-text-dim mb-2">{label}</div>
      <div className="space-y-1">
        <div className="flex justify-between"><span className="text-text-dim">Output</span><span className="tabular">{output}</span></div>
        <div className="flex justify-between"><span className="text-solid">Credit</span><span className="tabular text-solid">−{input}</span></div>
        <div className="flex justify-between border-t border-rule/60 pt-1 font-semibold"><span>Net</span><span className="tabular">{net}</span></div>
      </div>
    </div>
  );
}

export function Section({
  title, children, action,
}: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 h-[42px] border-b border-rule">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim font-medium">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Th({ children, align = "left", colSpan }: { children?: React.ReactNode; align?: "left" | "right"; colSpan?: number }) {
  return (
    <th colSpan={colSpan} className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

export function Td({
  children, align = "left", className = "", colSpan,
}: { children?: React.ReactNode; align?: "left" | "right"; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}
