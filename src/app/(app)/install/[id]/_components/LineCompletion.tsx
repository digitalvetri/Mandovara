"use client";

// Per-line completion form on the install detail page.
// Fields: installed delta qty, dye lot used, one-off issue note.
// Photos and remote serials live in the schema for 5c-PWA — this
// office view keeps the surface tight.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeInstallLine } from "@/modules/install/actions";

interface Props {
  lineId:           string;
  pendingForOrder:  string;   // remaining on the parent OrderLine (across all visits)
  currentInstalled: string;
  disabled?:        boolean;  // e.g. visit is already COMPLETED
}

export function LineCompletion({
  lineId, pendingForOrder, currentInstalled, disabled,
}: Props) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [qty, setQty]   = useState("");
  const [lot, setLot]   = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) { setError("Enter installed qty > 0."); return; }
    startT(async () => {
      const res = await completeInstallLine({
        lineId,
        installedQty: q,
        ...(lot.trim().length > 0  && { dyeLotUsed: lot.trim() }),
        ...(note.trim().length > 0 && { issue: note.trim() }),
      });
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      setQty(""); setLot(""); setNote("");
      router.refresh();
    });
  }

  const overallCap = Number(pendingForOrder);

  return (
    <div className="text-[11px] space-y-2">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.08em] text-text-dim">Installed</span>
        <span className="tabular text-text">{currentInstalled}</span>
        <span className="text-text-faint">·</span>
        <span className="text-[10px] text-text-dim">pending on order:</span>
        <span className="tabular text-text">{pendingForOrder}</span>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <Field label="add qty" value={qty} onChange={setQty}
               placeholder={overallCap === 0 ? "0" : String(overallCap)} width={62} />
        <Field label="dye lot" value={lot} onChange={setLot} placeholder="LOT-A" width={80} />
        <Field label="issue"   value={note} onChange={setNote} placeholder="—" width={140} />
        <button
          type="button"
          disabled={pending || disabled || overallCap === 0}
          onClick={submit}
          className="h-[24px] px-2 rounded-[4px] text-[11px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "…" : "Log install"}
        </button>
      </div>
      {error && <div className="text-[10.5px] text-bad">{error}</div>}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, width,
}: { label: string; value: string; onChange: (v: string) => void; placeholder: string; width: number }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-[9.5px] uppercase tracking-[0.06em] text-text-dim">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width }}
        className="h-[24px] px-1.5 text-[11px] tabular bg-white/60 border border-rule rounded-[4px] outline-none focus:border-accent"
      />
    </label>
  );
}
