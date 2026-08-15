"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Phone, Mail, Compass, IndianRupee, ClipboardList } from "lucide-react";
import { updateLead } from "@/modules/leads/actions";

type Option = { value: string; label: string };

interface Props {
  leadId: string;
  mobile: string;
  mobileFull: string;
  email: string;
  source: string;
  sourceLabel: string;
  budgetRange: string;
  budgetLabel: string;
  requirement: string;
  sourceOptions: readonly Option[];
  budgetOptions: readonly Option[];
  isConverted: boolean;
}

const lbl = "text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5";
const val = "text-[13.5px] text-text";
const inp = "w-full h-[32px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[13.5px] text-text outline-none focus:border-accent transition-colors";

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 min-w-0 py-1 px-1 -mx-1">
      <span className="mt-0.5 text-text-dim shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className={lbl}>{label}</div>
        {children}
      </div>
    </div>
  );
}

export function LeadDetailsCard({
  leadId, mobile, mobileFull, email, source, sourceLabel,
  budgetRange, budgetLabel, requirement,
  sourceOptions, budgetOptions, isConverted,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState({ mobile, email, source, budgetRange, requirement });

  function startEdit() {
    setDrafts({ mobile, email, source, budgetRange, requirement });
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setDrafts({ mobile, email, source, budgetRange, requirement });
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    const changed: Record<string, string> = {};
    if (drafts.mobile !== mobile)           changed.mobile = drafts.mobile;
    if (drafts.email !== email)             changed.email = drafts.email;
    if (drafts.source !== source)           changed.source = drafts.source;
    if (drafts.budgetRange !== budgetRange) changed.budgetRange = drafts.budgetRange;
    if (drafts.requirement !== requirement) changed.requirement = drafts.requirement;
    if (Object.keys(changed).length === 0) { setEditing(false); return; }
    startTransition(async () => {
      const res = await updateLead({ id: leadId, ...changed });
      if (!res.ok) { setError(res.error ?? "Save failed"); return; }
      setEditing(false);
      router.refresh();
    });
  }

  const set = (k: keyof typeof drafts) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setDrafts((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      {/* ── Edit / Save / Cancel ─────────────────────────────── */}
      {!isConverted && (
        <div className="flex justify-end mb-3">
          {editing ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={cancel} disabled={pending}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-[6px] text-[12px] text-text-dim border border-rule hover:bg-surface-hover transition-colors disabled:opacity-60">
                <X size={12} strokeWidth={2} /> Cancel
              </button>
              <button type="button" onClick={save} disabled={pending}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-[6px] text-[12px] bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-60">
                <Check size={12} strokeWidth={2.2} /> {pending ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEdit}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-[6px] text-[12px] text-text-dim border border-rule hover:text-text hover:bg-surface-hover transition-colors">
              <Pencil size={12} strokeWidth={1.75} /> Edit
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-[6px] bg-fault/10 border border-fault/30 px-3 py-2 text-[12px] text-fault">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        <Field icon={<Phone size={14} strokeWidth={1.75} />} label="Mobile">
          {editing
            ? <input type="tel" value={drafts.mobile} onChange={set("mobile")} className={inp} placeholder="10-digit mobile" />
            : <div className={val}>{mobileFull || "—"}</div>}
        </Field>

        <Field icon={<Mail size={14} strokeWidth={1.75} />} label="Email">
          {editing
            ? <input type="email" value={drafts.email} onChange={set("email")} className={inp} placeholder="Add email" />
            : <div className={`${val} ${!email ? "text-text-faint" : ""}`}>{email || "—"}</div>}
        </Field>

        <Field icon={<Compass size={14} strokeWidth={1.75} />} label="Source">
          {editing
            ? (
              <select value={drafts.source} onChange={set("source")} className={inp}>
                {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )
            : <div className={val}>{sourceLabel || "—"}</div>}
        </Field>

        <Field icon={<IndianRupee size={14} strokeWidth={1.75} />} label="Budget range">
          {editing
            ? (
              <select value={drafts.budgetRange} onChange={set("budgetRange")} className={inp}>
                <option value="">— Not set —</option>
                {budgetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )
            : <div className={`${val} ${!budgetLabel ? "text-text-faint" : ""}`}>{budgetLabel || "—"}</div>}
        </Field>

        <div className="sm:col-span-2">
          <Field icon={<ClipboardList size={14} strokeWidth={1.75} />} label="Requirement">
            {editing
              ? (
                <textarea
                  value={drafts.requirement} onChange={set("requirement")} rows={3}
                  className={`${inp} h-auto resize-y py-2`}
                  placeholder="What are they asking about?"
                />
              )
              : (
                <div className={`${val} whitespace-pre-wrap ${!requirement ? "text-text-faint" : ""}`}>
                  {requirement || "—"}
                </div>
              )}
          </Field>
        </div>
      </div>
    </div>
  );
}
