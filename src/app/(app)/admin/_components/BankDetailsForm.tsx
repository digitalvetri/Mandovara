"use client";

// Company bank details, printed on every quotation under the total.
// Same read → Edit → Save card as CompanySettingsForm beside it.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { setBankDetails } from "@/modules/admin/bank-details-actions";
import { hasBankDetails, type BankDetails } from "@/modules/admin/bank-details";

const FIELDS: { key: keyof BankDetails; label: string; placeholder: string; upper?: boolean }[] = [
  { key: "bankName",      label: "Bank name",            placeholder: "e.g. Punjab National Bank" },
  { key: "accountName",   label: "Account name (optional)", placeholder: "e.g. Mandovara" },
  { key: "accountNumber", label: "Account number",       placeholder: "e.g. 009800GT00000013", upper: true },
  { key: "branch",        label: "Branch",               placeholder: "e.g. Coimbatore Main" },
  { key: "ifsc",          label: "IFSC code",            placeholder: "e.g. PUNB0009800", upper: true },
];

export function BankDetailsForm({ initial }: { initial: BankDetails }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<BankDetails>(initial);
  const [error, setError] = useState<string | null>(null);

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await setBankDetails(form);
      if (!res.ok) { setError(res.error ?? "Could not save"); return; }
      if (res.data) setForm(res.data);
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setForm(initial);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6">
        <div className="flex items-baseline justify-between mb-1">
          <div className="font-display text-[18px] font-semibold">Bank details</div>
          <button type="button" onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 h-[24px] px-2 rounded-[4px] text-[10.5px] text-text-dim hover:text-accent hover:bg-surface-2 transition-colors">
            <Pencil size={11} /> Edit
          </button>
        </div>
        <p className="text-[11.5px] text-text-dim mb-4">Printed on every quotation for the client to pay into.</p>
        {hasBankDetails(initial) ? (
          <dl className="space-y-3 text-[12.5px]">
            <Row k="Bank name" v={initial.bankName} />
            {initial.accountName && <Row k="Account name" v={initial.accountName} />}
            <Row k="A/c no." v={initial.accountNumber} mono />
            <Row k="Branch" v={initial.branch || "—"} />
            <Row k="IFSC" v={initial.ifsc || "—"} mono />
          </dl>
        ) : (
          <div className="text-[12px] text-text-faint">
            Not set yet — quotations print without bank details until you add them.
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={commit} className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6">
      <div className="font-display text-[18px] font-semibold mb-4">Edit bank details</div>
      <div className="space-y-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">{f.label}</div>
            <input
              value={form[f.key]}
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className={`w-full h-[32px] px-2 bg-transparent border border-rule text-text rounded-[6px] text-[12.5px] outline-none focus:border-accent ${f.upper ? "tabular uppercase" : ""}`}
            />
          </label>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-text-faint">Clear every field to stop printing bank details.</p>
      {error && <div className="mt-3 text-[11.5px] text-fault">{error}</div>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={cancel}
                className="h-[30px] px-3 text-[11.5px] text-text-dim hover:text-text transition-colors">Cancel</button>
        <button type="submit" disabled={pending}
                className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-40">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px] shrink-0">{k}</dt>
      <dd className={`text-text text-right break-all ${mono ? "tabular text-[12px]" : ""}`}>{v}</dd>
    </div>
  );
}
