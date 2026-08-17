"use client";

import { useEffect, useState } from "react";

export function PriceInputs({
  initialMin, initialMax, onApply,
}: {
  initialMin: string;
  initialMax: string;
  onApply: (min: string, max: string) => void;
}) {
  const [min, setMin] = useState(initialMin);
  const [max, setMax] = useState(initialMax);
  useEffect(() => setMin(initialMin), [initialMin]);
  useEffect(() => setMax(initialMax), [initialMax]);
  return (
    <div className="px-4 py-2 flex items-center gap-2">
      <PriceField value={min} onChange={setMin} placeholder="Min" />
      <span className="text-text-faint text-[11px]">to</span>
      <PriceField value={max} onChange={setMax} placeholder="Max" />
      <button
        type="button"
        onClick={() => onApply(min.trim(), max.trim())}
        className="ml-1 h-[26px] px-2 rounded-[6px] bg-gold text-ink text-[10px] font-semibold uppercase tracking-[0.1em] hover:bg-gold-strong transition-colors"
      >
        Apply
      </button>
    </div>
  );
}

function PriceField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-w-0 h-[26px] px-2 rounded-[6px] bg-ink border border-rule text-[11px] text-text placeholder:text-text-faint tabular outline-none focus:border-accent"
    />
  );
}
