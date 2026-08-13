"use client";

import { AlertTriangle, Info } from "lucide-react";

export function TwoColumn({ form, result }: { form: React.ReactNode; result: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-[14px] bg-surface border border-rule p-6 space-y-4">{form}</div>
      <div className="rounded-[14px] bg-surface border border-rule p-6 space-y-5">{result}</div>
    </div>
  );
}

export function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[38px] px-4 text-[12.5px] tracking-[0.02em] relative transition-colors ${
        active
          ? "text-text after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-accent"
          : "text-text-dim hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export function NumField({
  label, value, onChange, step,
}: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] tracking-[0.14em] uppercase text-text-dim">{label}</div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step ?? 1}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-full h-[36px] px-3 bg-white/60 border border-rule rounded-[6px] text-[13px] tabular outline-none focus:border-accent transition-colors"
      />
    </label>
  );
}

export function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] tracking-[0.14em] uppercase text-text-dim">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[36px] px-3 bg-white/60 border border-rule rounded-[6px] text-[13px] outline-none focus:border-accent transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function CheckField({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-text">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[16px] w-[16px] accent-accent"
      />
      {label}
    </label>
  );
}

export function HeroNumber({
  label, value, unit, decimals,
}: { label: string; value: number | string; unit?: string; decimals?: number }) {
  const display =
    typeof value === "number" && decimals != null ? value.toFixed(decimals) : String(value);
  return (
    <div className="pb-2">
      <div className="text-[10.5px] tracking-[0.16em] uppercase text-text-dim mb-1">{label}</div>
      <div className="flex items-baseline gap-2 relative">
        <span className="font-display text-[44px] leading-none tabular text-text">{display}</span>
        {unit && <span className="text-[13px] text-text-dim tracking-[0.06em] uppercase">{unit}</span>}
      </div>
      <div className="mt-2 h-[1px] w-[64px] bg-accent" />
    </div>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">{children}</div>;
}

export function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div>
      <div className="text-[10.5px] tracking-[0.14em] uppercase text-text-dim mb-0.5">{label}</div>
      <div className="text-[15px] tabular text-text">
        {value}
        {unit && <span className="ml-1 text-[11px] text-text-dim uppercase tracking-[0.06em]">{unit}</span>}
      </div>
    </div>
  );
}

export function Warnings({ warnings, version }: { warnings: readonly string[]; version: string }) {
  return (
    <div className="pt-3 border-t border-rule/60">
      {warnings.length === 0 ? (
        <div className="flex items-center gap-2 text-[11.5px] text-text-dim">
          <Info size={13} strokeWidth={1.75} />
          No warnings from the engine.
        </div>
      ) : (
        <ul className="space-y-2">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-text bg-accent/8 border border-accent/25 rounded-[8px] px-3 py-2">
              <AlertTriangle size={13} strokeWidth={1.75} className="mt-[3px] text-accent shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-text-faint">
        Engine · {version}
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-[12px] text-bad bg-bad/8 border border-bad/30 rounded-[8px] px-3 py-2">
      <AlertTriangle size={13} strokeWidth={1.75} className="mt-[3px] shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
