"use client";

export function NumInput({
  label, v, set, step,
}: { label: string; v: number; set: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
      <input
        type="number"
        value={Number.isFinite(v) ? v : ""}
        step={step ?? 1}
        inputMode="decimal"
        onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-full h-[36px] px-3 bg-white/60 border border-rule rounded-[6px] text-[13px] tabular outline-none focus:border-accent transition-colors"
      />
    </label>
  );
}

export function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
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

export function Check({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-text sm:mt-6">
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

export function NumberOrText({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[36px] px-3 bg-white/60 border border-rule rounded-[6px] text-[13px] outline-none focus:border-accent transition-colors"
      />
    </label>
  );
}

export function Stat({
  label, value, unit, emphasize,
}: { label: string; value: string | number; unit?: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] tracking-[0.14em] uppercase text-text-dim mb-0.5">{label}</div>
      <div className={emphasize ? "font-display text-[24px] leading-none tabular text-text" : "text-[15px] tabular text-text"}>
        {value}
        {unit && <span className="ml-1 text-[10.5px] text-text-dim uppercase tracking-[0.06em]">{unit}</span>}
      </div>
    </div>
  );
}
