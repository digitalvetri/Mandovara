"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createFollowUp } from "@/modules/followups/actions";
import type {
  FollowUpPickerLead, FollowUpPickerClient,
} from "@/modules/followups/queries";

interface Props {
  leads: FollowUpPickerLead[];
  clients: FollowUpPickerClient[];
}

export function NewFollowUpForm({ leads, clients }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attachTo, setAttachTo] = useState<"lead" | "client">("lead");
  const [leadId, setLeadId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const [dueAt, setDueAt] = useState<string>(iso(tomorrow));
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        dueAt, note,
        leadId:   attachTo === "lead"   ? leadId   : "",
        clientId: attachTo === "client" ? clientId : "",
      };
      const res = await createFollowUp(payload);
      if (!res.ok) { setError(res.error ?? "Could not create"); return; }
      router.push("/followups" as Route);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="mb-4">
        <div className="mb-2 text-[11px] tracking-[0.06em] uppercase text-text-dim">Attach to</div>
        <div className="flex items-center gap-1 border border-rule rounded-[6px] bg-white/60 h-[34px] p-0.5 w-fit">
          {(["lead", "client"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setAttachTo(k)}
                    className={[
                      "px-4 rounded-[4px] text-[12px] h-full transition-colors",
                      attachTo === k ? "bg-accent text-white" : "text-text-dim hover:text-text",
                    ].join(" ")}>
              {k === "lead" ? "Lead" : "Client"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        {attachTo === "lead" && (
          <Field label="Lead" required span={2}>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={fieldCls}>
              <option value="">— pick a lead —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.name} · {l.mobile}</option>
              ))}
            </select>
          </Field>
        )}
        {attachTo === "client" && (
          <Field label="Client" required span={2}>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={fieldCls}>
              <option value="">— pick a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.mobile}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Due date" required>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
                 className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Note" span={2}>
          <input value={note} onChange={(e) => setNote(e.target.value)}
                 placeholder="What to talk about?"
                 className={fieldCls} />
        </Field>
      </div>

      {error && <div className="mt-4 text-[12px] text-bad">{error}</div>}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()}
                className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={pending || (attachTo === "lead" ? !leadId : !clientId)}
                className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors">
          {pending ? "Saving…" : "Create follow-up"}
        </button>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function Field({ label, required, span = 1, children }: { label: string; required?: boolean; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <div className={span === 2 ? "lg:col-span-2" : undefined}>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
    </div>
  );
}
