"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateCompanySettings } from "@/modules/admin/actions";
import type { CompanySettings } from "@/modules/admin/queries";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CompanySettingsForm({ initial }: { initial: CompanySettings }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial.orgName);
  const [gstin, setGstin] = useState(initial.gstin ?? "");
  const [fyStartMonth, setFyStartMonth] = useState(initial.fyStartMonth);
  const [error, setError] = useState<string | null>(null);

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateCompanySettings({
        orgId: initial.orgId, name, gstin, fyStartMonth,
      });
      if (!res.ok) { setError(res.error ?? "Could not save"); return; }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="rounded-[14px] bg-sidebar text-sidebar-text p-5 sm:p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-sidebar-dim">Company settings</div>
          <button type="button" onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 h-[24px] px-2 rounded-[4px] text-[10.5px] text-sidebar-dim hover:text-accent hover:bg-white/5 transition-colors">
            <Pencil size={11} /> Edit
          </button>
        </div>
        <dl className="space-y-3 text-[12.5px]">
          <Row k="Company"      v={initial.orgName || "—"} />
          <Row k="Financial year" v={initial.fyLabel} />
          <Row k="GSTIN"        v={initial.gstin ?? "—"} mono />
          <Row k="Invoice series" v={initial.invoiceSeries || "—"} mono />
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={commit} className="rounded-[14px] bg-sidebar text-sidebar-text p-5 sm:p-6">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-sidebar-dim mb-4">Edit company settings</div>
      <div className="space-y-3">
        <label className="block">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-sidebar-dim">Company name</div>
          <input value={name} onChange={(e) => setName(e.target.value)}
                 className="w-full h-[32px] px-2 bg-sidebar-hover text-sidebar-text rounded-[6px] text-[12.5px] outline-none focus:ring-1 focus:ring-accent" />
        </label>
        <label className="block">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-sidebar-dim">GSTIN</div>
          <input value={gstin} onChange={(e) => setGstin(e.target.value)}
                 placeholder="15 chars, e.g. 33ABCDE1234F1Z5"
                 className="w-full h-[32px] px-2 bg-sidebar-hover text-sidebar-text tabular uppercase rounded-[6px] text-[12.5px] outline-none focus:ring-1 focus:ring-accent" />
        </label>
        <label className="block">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-sidebar-dim">Financial year starts</div>
          <select value={fyStartMonth} onChange={(e) => setFyStartMonth(Number(e.target.value))}
                  className="w-full h-[32px] px-2 bg-sidebar-hover text-sidebar-text rounded-[6px] text-[12.5px] outline-none focus:ring-1 focus:ring-accent">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="mt-3 text-[11.5px] text-bad">{error}</div>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)}
                className="h-[30px] px-3 text-[11.5px] text-sidebar-dim hover:text-sidebar-text">Cancel</button>
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
      <dt className="text-sidebar-dim text-[11.5px]">{k}</dt>
      <dd className={`text-sidebar-text text-right ${mono ? "tabular" : ""}`}>{v}</dd>
    </div>
  );
}
