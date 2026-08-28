// Small form/table primitives for EmployeesSection, split out on
// 2026-08-29 when the password-reset control pushed that file past
// CLAUDE.md §10's 300-line ceiling.

export const fieldCls =
  "w-full h-[32px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent";

export function iso(d: Date): string { return d.toISOString().slice(0, 10); }
export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    ACTIVE: "Active", ON_LEAVE: "On leave", RESIGNED: "Resigned", TERMINATED: "Terminated",
  };
  return map[s] ?? s;
}
export function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase tracking-[0.06em] text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
      {hint && <div className="mt-0.5 text-[10.5px] text-text-faint">{hint}</div>}
    </label>
  );
}
export function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
export function Td({ children, align = "left", className = "" }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>{children}</td>;
}
