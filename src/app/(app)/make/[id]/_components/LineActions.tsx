"use client";

// Per-line inline forms for the make detail page. Three actions
// share one component because they all bind to the same MakeJobLine
// id and follow the same submit-and-refresh pattern.
//
//   Issue material (fabric + lining metres)
//   Record usage   (actual metres + optional wastage override)
//   QC pass / fail (with optional note)

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, XCircle } from "lucide-react";
import {
  issueMakeJobLineMaterial, recordMakeJobLineUsage, qcMakeJobLine,
} from "@/modules/make/actions";

interface Props {
  lineId:            string;
  fabricIssuedM:     number | null;
  liningIssuedM:     number | null;
  actualUsedM:       number | null;
  qcPassed:          boolean;
}

export function LineActions({
  lineId, fabricIssuedM, liningIssuedM, actualUsedM, qcPassed,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fabricInput, setFabric] = useState(fabricIssuedM?.toString() ?? "");
  const [liningInput, setLining] = useState(liningIssuedM?.toString() ?? "");
  const [usageInput,  setUsage]  = useState(actualUsedM?.toString()   ?? "");

  function commitIssue() {
    setError(null);
    const fabric = fabricInput === "" ? undefined : Number(fabricInput);
    const lining = liningInput === "" ? undefined : Number(liningInput);
    if (fabric == null && lining == null) {
      setError("Enter fabric and/or lining metres.");
      return;
    }
    if ((fabric != null && Number.isNaN(fabric)) || (lining != null && Number.isNaN(lining))) {
      setError("Numbers only, please.");
      return;
    }
    startTransition(async () => {
      const res = await issueMakeJobLineMaterial({
        lineId,
        ...(fabric != null && { fabricIssuedM: fabric }),
        ...(lining != null && { liningIssuedM: lining }),
      });
      if (!res.ok) { setError(res.error ?? "Could not save"); return; }
      router.refresh();
    });
  }

  function commitUsage() {
    setError(null);
    const used = Number(usageInput);
    if (Number.isNaN(used)) { setError("Enter used metres."); return; }
    startTransition(async () => {
      const res = await recordMakeJobLineUsage({ lineId, actualUsedM: used });
      if (!res.ok) { setError(res.error ?? "Could not save"); return; }
      router.refresh();
    });
  }

  function commitQc(passed: boolean) {
    setError(null);
    // Fail always prompts for a note; pass captures optionally.
    const notes = passed
      ? window.prompt("QC pass notes (optional):", "")?.trim()
      : window.prompt("Reason for QC fail (required):", "")?.trim();
    if (!passed && (!notes || notes.length === 0)) {
      setError("QC fail requires a reason.");
      return;
    }
    startTransition(async () => {
      const res = await qcMakeJobLine({
        lineId, passed,
        ...(notes != null && notes.length > 0 && { notes }),
      });
      if (!res.ok) { setError(res.error ?? "Could not save"); return; }
      router.refresh();
    });
  }

  return (
    <div className="text-[11px] space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <FieldMini label="fabric m" value={fabricInput} onChange={setFabric} placeholder="0.0" />
        <FieldMini label="lining m" value={liningInput} onChange={setLining} placeholder="0.0" />
        <SmallBtn onClick={commitIssue} disabled={pending}>Issue</SmallBtn>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <FieldMini label="used m"   value={usageInput}  onChange={setUsage}  placeholder="0.0" />
        <SmallBtn onClick={commitUsage} disabled={pending || usageInput === ""}>Record used</SmallBtn>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => commitQc(true)}
          disabled={pending}
          className="h-[26px] px-2 rounded-[5px] text-[11px] font-medium bg-good/12 text-good hover:bg-good/20 disabled:opacity-60 flex items-center gap-1"
        >
          <Check size={11} /> QC pass
        </button>
        <button
          type="button"
          onClick={() => commitQc(false)}
          disabled={pending}
          className="h-[26px] px-2 rounded-[5px] text-[11px] font-medium bg-bad/12 text-bad hover:bg-bad/20 disabled:opacity-60 flex items-center gap-1"
        >
          <XCircle size={11} /> Fail
        </button>
        <span className={`text-[10.5px] tabular ml-1 ${qcPassed ? "text-good" : "text-text-faint"}`}>
          {qcPassed ? "passed" : "not yet"}
        </span>
      </div>
      {error && <div className="text-[10.5px] text-bad">{error}</div>}
    </div>
  );
}

function FieldMini({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-[9.5px] uppercase tracking-[0.06em] text-text-dim">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-[60px] h-[24px] px-1.5 text-[11px] tabular bg-white/60 border border-rule rounded-[4px] outline-none focus:border-accent"
      />
    </label>
  );
}

function SmallBtn({
  onClick, disabled, children,
}: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-[24px] px-2 rounded-[4px] text-[11px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
    >
      {children}
    </button>
  );
}
