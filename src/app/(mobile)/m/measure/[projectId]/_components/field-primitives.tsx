"use client";

// Small building blocks used by ItemScreen. Kept out of the main
// component file so it stays under CLAUDE.md §10 300-line ceiling.

import type { ReactNode } from "react";
import { Check } from "lucide-react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mb-1">{label}</div>
      {children}
    </label>
  );
}

export function DimField({ label, value, onChange, integer }: {
  label: string; value: string; onChange: (v: string) => void; integer?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0"
        className="w-full h-[56px] rounded-[10px] border border-rule bg-surface px-4 text-[18px] tabular text-text placeholder:text-text-faint"
      />
    </Field>
  );
}

export function SelectPill<T extends string>({ value, options, onChange }: {
  value: T; options: readonly T[]; onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full h-[56px] rounded-[10px] border border-rule bg-surface px-3 text-[14px] text-text appearance-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o.replace(/_/g, " ").toLowerCase()}</option>
      ))}
    </select>
  );
}

export function EvidenceButton({ label, icon, attached, onOpen }: {
  label: string; icon: ReactNode; attached: boolean; onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`min-h-[56px] rounded-[10px] border inline-flex items-center justify-center gap-1.5 ${
        attached ? "border-solid/40 bg-solid-tint text-solid-strong" : "border-rule bg-surface text-text hover:border-gold"
      }`}
    >
      {attached ? <Check size={16} /> : icon}
      {label}{attached ? " ✓" : ""}
    </button>
  );
}
