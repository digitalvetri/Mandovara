"use client";

import { useState, useTransition, type ElementType } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil, Check, X,
  Phone, Mail, Compass, IndianRupee, MapPin, ClipboardList,
} from "lucide-react";
import { updateLead } from "@/modules/leads/actions";

type Option = { value: string; label: string };

interface Props {
  leadId:          string;
  mobile:          string;
  mobileFull:      string;
  email:           string;
  source:          string;
  sourceLabel:     string;
  budgetDisplayStr: string;
  budgetEditStr:   string;
  siteAddress:     string;
  requirement:     string;
  sourceOptions:   readonly Option[];
  isConverted:     boolean;
}

// ── shared input styles ────────────────────────────────────────────
const inp  = "w-full h-[28px] px-2 bg-surface-2 border border-rule rounded-[5px] text-[13px] text-text outline-none focus:border-accent transition-colors";
const area = "w-full px-2 py-1.5 bg-surface-2 border border-rule rounded-[5px] text-[13px] text-text outline-none focus:border-accent transition-colors resize-none";

// ── label helper ──────────────────────────────────────────────────
function Lbl({ icon: Icon, text }: { icon: ElementType; text: string }) {
  return (
    <div className="flex items-center gap-1 mb-1.5">
      <Icon size={10} strokeWidth={1.8} className="text-text-dim shrink-0" />
      <span className="text-[9.5px] uppercase tracking-[0.15em] text-text-dim font-medium">{text}</span>
    </div>
  );
}

export function LeadDetailsCard({
  leadId, mobile, mobileFull, email, source, sourceLabel,
  budgetDisplayStr, budgetEditStr, siteAddress, requirement,
  sourceOptions, isConverted,
}: Props) {
  const router = useRouter();
  const [editing, setEditing]   = useState(false);
  const [pending, startTransition] = useTransition();
  const [error,  setError]      = useState<string | null>(null);
  const [drafts, setDrafts]     = useState({
    mobile, email, source,
    estimatedBudget: budgetEditStr,
    address: siteAddress,
    requirement,
  });

  function startEdit() {
    setDrafts({ mobile, email, source, estimatedBudget: budgetEditStr, address: siteAddress, requirement });
    setError(null);
    setEditing(true);
  }
  function cancel() {
    setDrafts({ mobile, email, source, estimatedBudget: budgetEditStr, address: siteAddress, requirement });
    setError(null);
    setEditing(false);
  }
  function save() {
    setError(null);
    const changed: Record<string, string> = {};
    if (drafts.mobile          !== mobile)        changed.mobile          = drafts.mobile;
    if (drafts.email           !== email)         changed.email           = drafts.email;
    if (drafts.source          !== source)        changed.source          = drafts.source;
    if (drafts.estimatedBudget !== budgetEditStr) changed.estimatedBudget = drafts.estimatedBudget;
    if (drafts.address         !== siteAddress)   changed.address         = drafts.address;
    if (drafts.requirement     !== requirement)   changed.requirement     = drafts.requirement;
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

  const dim = "text-text-faint";
  const val = "text-[13.5px] text-text leading-snug";

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">

      {/* ── Card header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-rule">
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-dim font-semibold">
          Contact &amp; Site Details
        </span>
        {!isConverted && (
          editing ? (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={cancel} disabled={pending}
                className="flex items-center gap-1 h-[26px] px-2.5 rounded-[5px] text-[11.5px] text-text-dim border border-rule hover:bg-surface-hover transition-colors disabled:opacity-50">
                <X size={11} strokeWidth={2} /> Cancel
              </button>
              <button type="button" onClick={save} disabled={pending}
                className="flex items-center gap-1 h-[26px] px-2.5 rounded-[5px] text-[11.5px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                <Check size={11} strokeWidth={2.2} /> {pending ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEdit}
              className="flex items-center gap-1 h-[26px] px-2.5 rounded-[5px] text-[11.5px] text-text-dim border border-rule hover:text-text hover:bg-surface-hover transition-colors">
              <Pencil size={11} strokeWidth={1.75} /> Edit
            </button>
          )
        )}
      </div>

      {/* ── Error banner ────────────────────────────────────────── */}
      {error && (
        <div className="px-5 py-2 bg-fault/8 border-b border-fault/25 text-[12px] text-fault">
          {error}
        </div>
      )}

      {/* ── Info grid ───────────────────────────────────────────── */}
      <div>

        {/* Row 1 — Mobile / Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="px-5 py-3 border-b border-rule/60 sm:border-r">
            <Lbl icon={Phone} text="Mobile" />
            {editing
              ? <input type="tel" value={drafts.mobile} onChange={set("mobile")} className={inp} placeholder="10-digit" />
              : <div className={val}>{mobileFull || <span className={dim}>—</span>}</div>}
          </div>
          <div className="px-5 py-3 border-b border-rule/60">
            <Lbl icon={Mail} text="Email" />
            {editing
              ? <input type="email" value={drafts.email} onChange={set("email")} className={inp} placeholder="Optional" />
              : <div className={`${val} ${!email ? dim : ""}`}>{email || "—"}</div>}
          </div>
        </div>

        {/* Row 2 — Source / Budget */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="px-5 py-3 border-b border-rule/60 sm:border-r">
            <Lbl icon={Compass} text="Source" />
            {editing
              ? (
                <select value={drafts.source} onChange={set("source")} className={inp}>
                  {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )
              : <div className={val}>{sourceLabel || <span className={dim}>—</span>}</div>}
          </div>
          <div className="px-5 py-3 border-b border-rule/60">
            <Lbl icon={IndianRupee} text="Estimated Budget" />
            {editing
              ? (
                <div className="flex items-center h-[28px] bg-surface-2 border border-rule rounded-[5px] focus-within:border-accent transition-colors overflow-hidden">
                  <span className="px-2 text-[11.5px] text-text-dim border-r border-rule h-full flex items-center shrink-0">₹</span>
                  <input
                    type="text" inputMode="numeric"
                    value={drafts.estimatedBudget} onChange={set("estimatedBudget")}
                    className="flex-1 h-full px-2 bg-transparent text-[13px] tabular-nums text-text outline-none"
                    placeholder="e.g. 250000"
                  />
                </div>
              )
              : <div className={`${val} tabular-nums ${!budgetDisplayStr ? dim : ""}`}>{budgetDisplayStr || "—"}</div>}
          </div>
        </div>

        {/* Row 3 — Site Address (full width) */}
        <div className="px-5 py-3 border-b border-rule/60">
          <Lbl icon={MapPin} text="Site Address" />
          {editing
            ? <textarea rows={2} value={drafts.address} onChange={set("address")} className={area} placeholder="Flat/House no., Street, Area, Landmark…" />
            : <div className={`${val} whitespace-pre-wrap ${!siteAddress ? dim : ""}`}>{siteAddress || "—"}</div>}
        </div>

        {/* Row 4 — Requirement (full width) */}
        <div className="px-5 py-3">
          <Lbl icon={ClipboardList} text="Requirement" />
          {editing
            ? <textarea rows={3} value={drafts.requirement} onChange={set("requirement")} className={area} placeholder="What is the customer looking for?" />
            : <div className={`${val} whitespace-pre-wrap ${!requirement ? dim : ""}`}>{requirement || "—"}</div>}
        </div>

      </div>
    </div>
  );
}
