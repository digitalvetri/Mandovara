"use client";

// The inline-edit form's field primitives.
//
// Split out of ItemCard so that file stays under the §10 300-line limit;
// they are presentation only and have no business rules in them.

export function EField({
  label, value, onChange, placeholder, inputMode, width,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: "decimal" | "numeric"; width?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${width ?? ""}`}>
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[36px] rounded-[6px] border border-rule bg-transparent px-2 text-[12.5px] text-text tabular"
      />
    </label>
  );
}

export function ESelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[36px] rounded-[6px] border border-rule bg-transparent px-2 pr-8 text-[12.5px] text-text"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
        ))}
      </select>
    </label>
  );
}

