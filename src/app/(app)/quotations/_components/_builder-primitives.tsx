"use client";

// Shared UI primitives for QuotationBuilder — extracted to keep the
// builder file under the 300-line limit (CLAUDE.md §10).

export const fieldCls =
  "w-full h-[38px] px-3 bg-white/60 border border-rule rounded-[8px] text-[12.5px] outline-none focus:border-accent transition-colors";

export function iso(d: Date): string { return d.toISOString().slice(0, 10); }

export function StepButton({ onClick, label, children }: {
  onClick: () => void; label: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-[28px] w-[28px] grid place-items-center rounded-[6px] border border-rule text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
    >
      {children}
    </button>
  );
}

export function Th({ children, align = "left", width }: {
  children?: React.ReactNode; align?: "left" | "center" | "right"; width?: number;
}) {
  const cls = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return (
    <th style={width ? { width } : undefined} className={`px-3 h-[36px] font-medium ${cls}`}>
      {children}
    </th>
  );
}

export function Td({ children, align = "left" }: {
  children: React.ReactNode; align?: "left" | "center" | "right";
}) {
  const cls = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return <td className={`px-3 py-3 ${cls}`}>{children}</td>;
}
