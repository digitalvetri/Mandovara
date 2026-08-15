"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { X, UserCheck, Building2, MapPin, IndianRupee, CalendarDays, ClipboardList } from "lucide-react";
import { convertLead } from "@/modules/leads/actions";

const PROJECT_TYPES = ["Residential", "Commercial", "Office", "Retail", "Hospitality", "Other"] as const;

interface Props {
  leadId: string;
  leadName: string;
  mobile: string;
  email: string | null;
  open: boolean;
  onClose: () => void;
}

const lbl = "block mb-1 text-[10.5px] uppercase tracking-[0.12em] text-text-dim";
const inp = "w-full h-[34px] px-3 bg-surface-2 border border-rule rounded-[7px] text-[13px] text-text outline-none focus:border-accent transition-colors";
const ta  = "w-full px-3 py-2 bg-surface-2 border border-rule rounded-[7px] text-[13px] text-text outline-none focus:border-accent transition-colors resize-y";

export function ConvertLeadModal({ leadId, leadName, mobile, email, open, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectName:       leadName,
    projectType:       "Residential",
    siteCity:          "",
    requirement:       "",
    estimatedBudget:   "",
    expectedStartDate: "",
  });

  if (!open) return null;

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectName.trim()) { setError("Project name is required."); return; }
    setError(null);
    startTransition(async () => {
      const res = await convertLead({
        id:                leadId,
        projectName:       form.projectName.trim(),
        projectType:       form.projectType || undefined,
        siteCity:          form.siteCity.trim() || undefined,
        requirement:       form.requirement.trim() || undefined,
        estimatedBudget:   form.estimatedBudget.trim() || undefined,
        expectedStartDate: form.expectedStartDate || undefined,
      });
      if (!res.ok || !res.data) { setError(res.error ?? "Could not convert lead"); return; }
      onClose();
      router.push(`/clients/${res.data.clientId}` as Route);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm">
      <div className="w-full max-w-[520px] bg-surface border border-rule rounded-[16px] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
          <div className="flex items-center gap-2.5">
            <UserCheck size={15} className="text-good" strokeWidth={1.75} />
            <h2 className="text-[15px] font-semibold text-text">Convert to Client</h2>
          </div>
          <button type="button" onClick={onClose}
                  className="h-7 w-7 grid place-items-center rounded-full text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Client preview (read-only) */}
        <div className="px-6 py-4 bg-surface-2 border-b border-rule">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-2">Client info (from lead)</div>
          <div className="text-[14px] font-semibold text-text">{leadName}</div>
          <div className="text-[12.5px] text-text-dim mt-0.5">
            {mobile}{email ? ` · ${email}` : ""}
          </div>
        </div>

        {/* Project form */}
        <form onSubmit={submit} className="px-6 py-5 space-y-4 max-h-[58vh] overflow-y-auto">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim -mb-1">New project</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Project Name *</label>
              <input value={form.projectName} onChange={set("projectName")} className={inp} placeholder={leadName} />
            </div>

            <div>
              <label className={lbl}><Building2 size={10} className="inline mr-1" />Project Type</label>
              <select value={form.projectType} onChange={set("projectType")} className={inp}>
                {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}><MapPin size={10} className="inline mr-1" />Site City</label>
              <input value={form.siteCity} onChange={set("siteCity")} className={inp} placeholder="e.g. Coimbatore" />
            </div>

            <div>
              <label className={lbl}><IndianRupee size={10} className="inline mr-1" />Estimated Budget (₹)</label>
              <input value={form.estimatedBudget} onChange={set("estimatedBudget")} className={inp}
                     placeholder="e.g. 250000" inputMode="numeric" />
            </div>

            <div>
              <label className={lbl}><CalendarDays size={10} className="inline mr-1" />Expected Start Date</label>
              <input type="date" value={form.expectedStartDate} onChange={set("expectedStartDate")} className={inp} />
            </div>

            <div className="sm:col-span-2">
              <label className={lbl}><ClipboardList size={10} className="inline mr-1" />Requirement</label>
              <textarea value={form.requirement} onChange={set("requirement")} className={ta} rows={3}
                        placeholder="What is the client looking for?" />
            </div>
          </div>

          {error && (
            <div className="rounded-[6px] bg-fault/10 border border-fault/30 px-3 py-2 text-[12px] text-fault">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={pending}
                    className="h-9 px-4 rounded-[8px] text-[13px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={pending}
                    className="inline-flex items-center gap-2 h-9 px-5 rounded-[8px] bg-good/15 text-good border border-good/25 text-[13px] font-medium hover:bg-good/25 transition-colors disabled:opacity-60">
              <UserCheck size={14} strokeWidth={1.75} />
              {pending ? "Converting…" : "Convert & Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
