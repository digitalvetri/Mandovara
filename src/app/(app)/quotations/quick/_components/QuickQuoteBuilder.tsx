"use client";

// Single-screen quick-quote form. Pick project (or type a new name),
// add line rows with the catalog picker, enter rough dims + qty +
// rate. Live totals in the sidebar. One click generates the full
// Quotation (with preliminary MeasurementItems) and lands you on
// /quotations/[id] ready to send.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Plus, Loader2 } from "lucide-react";
import { formatINR, parseINR } from "@/kernel/money/format";
import { createQuickQuote } from "@/modules/quotations/quick-actions";
import { LineRow } from "./LineRow";
import { type LineDraft, emptyLine, runningTotals } from "./line-utils";

interface Props {
  // Exactly one of leadId / clientId is set — mirror of the server-side
  // XOR (FIXES-01 §5.1). Lead-scoped mode hides the project selector.
  leadId?:    string;
  clientId?:  string;
  clientName: string;
  branches:   { id: string; name: string }[];
  projects:   { id: string; name: string; number: string }[];
}

export function QuickQuoteBuilder({ leadId, clientId, clientName, branches, projects }: Props) {
  const router = useRouter();
  const isLeadScoped = !!leadId;
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "__new__");
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [branchId] = useState<string>(branches[0]?.id ?? "");
  const [validForDays, setValidForDays] = useState<string>("30");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const usingNewProject = projectId === "__new__";
  const canSubmit =
    branchId &&
    // Lead-scoped skips the project gate; client-scoped needs a project pick.
    (isLeadScoped || (usingNewProject ? newProjectName.trim().length > 0 : projectId.length > 0)) &&
    lines.length > 0 &&
    lines.every((l) =>
      l.label.trim() &&
      parseFloat(l.quantity) > 0 &&
      l.rateEditable && parseFloat(l.rateEditable) > 0,
    );

  const totals = useMemo(() => runningTotals(lines), [lines]);

  function patch(i: number, next: Partial<LineDraft>): void {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...next } : l)));
  }
  function addLine(): void { setLines((prev) => [...prev, emptyLine()]); }
  function removeLine(i: number): void { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  function generate(): void {
    setError(null);
    start(async () => {
      const payload = {
        ...(isLeadScoped ? { leadId } : { clientId }),
        branchId,
        validForDays: parseInt(validForDays, 10) || 30,
        ...(!isLeadScoped && (usingNewProject
          ? { newProjectName: newProjectName.trim() }
          : { projectId })),
        lines: lines.map((l) => ({
          label:       l.label.trim(),
          quantity:    parseFloat(l.quantity) || 1,
          gstRate:     l.gstRate ?? 18,
          unit:        (l.sellUnit ?? "METRE") as "METRE"|"ROLL"|"SQFT"|"SQM"|"PIECE"|"SET"|"BOX"|"RUNNING_FT",
          ratePaise:   parseINR(l.rateEditable ?? "0").toString(),
          discountPct: parseFloat(l.discountPct) || 0,
        })),
      };
      const res = await createQuickQuote(payload);
      if (!res.ok || !res.data) {
        setError(res.error ?? "Could not create quotation");
        return;
      }
      // A lead-scoped quote belongs to the lead's workflow: hand the
      // operator back to the lead page, where the quotation now appears
      // in the sidebar with its own Send / "client accepted" actions
      // (2026-08-27, owner instruction). Client-scoped quotes still open
      // the quotation itself — there is no lead to return to.
      router.push(
        (isLeadScoped
          ? `/leads/${leadId}`
          : `/quotations/${res.data.quotationId}`) as Route,
      );
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 pb-10">
      <div className="space-y-4">
        {isLeadScoped ? (
          <div className="rounded-[14px] bg-gold-tint border border-gold/40 p-4 text-[12px] text-text">
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mr-2">Lead quote</span>
            Drafting a quotation for <span className="font-medium">{clientName}</span> —
            no client or project is created yet. You'll return to the lead to send it,
            and the lead becomes a client only once this quotation is accepted.
          </div>
        ) : (
          <div className="rounded-[14px] bg-surface border border-rule p-4">
            <label className="block">
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mb-1">Project</div>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full h-[40px] rounded-[8px] border border-rule bg-transparent px-2 text-[12.5px] text-text"
                >
                  {projects.length === 0 && <option value="__new__">No projects yet — create one</option>}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.number} · {p.name}</option>
                  ))}
                  <option value="__new__">+ Create a new project for {clientName}</option>
                </select>
              </label>
            {usingNewProject && (
              <label className="block mt-3">
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mb-1">New project name</div>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Villa at Saibaba Colony · Apartment fitout · etc."
                  className="w-full h-[40px] rounded-[8px] border border-rule bg-transparent px-3 text-[13px] text-text placeholder:text-text-faint"
                  maxLength={120}
                />
              </label>
            )}
          </div>
        )}

        <div className="space-y-2">
          {lines.map((l, i) => (
            <LineRow
              key={l.key}
              line={l}
              onChange={(next) => patch(i, next)}
              {...(lines.length > 1 ? { onRemove: () => removeLine(i) } : {})}
            />
          ))}
          <button
            type="button"
            onClick={addLine}
            className="w-full min-h-[44px] rounded-[10px] border border-dashed border-rule text-text-dim hover:text-text hover:border-gold inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={13} /> Add another line
          </button>
        </div>
      </div>

      <aside className="h-fit lg:sticky lg:top-4 space-y-4">
        <div className="rounded-[14px] bg-surface border border-rule p-5">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Estimated total</div>
          <div className="font-display text-[28px] font-semibold text-text tabular-nums leading-none">
            {formatINR(totals.total)}
          </div>
          <dl className="mt-4 space-y-2 text-[12px]">
            <Row k="Sub-total" v={formatINR(totals.taxable)} />
            <Row k="GST" v={formatINR(totals.gst)} />
            <Row k="Lines" v={String(lines.length)} />
          </dl>
          <label className="mt-4 block">
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mb-1">Valid for (days)</div>
            <input
              type="text"
              inputMode="numeric"
              value={validForDays}
              onChange={(e) => setValidForDays(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full h-[40px] rounded-[8px] border border-rule bg-transparent px-3 text-[13px] tabular text-text"
            />
          </label>
          {error && <div className="mt-3 text-[11.5px] text-fault">{error}</div>}
          <button
            type="button"
            onClick={generate}
            disabled={!canSubmit || pending}
            className="mt-4 w-full min-h-[48px] rounded-[10px] bg-gold text-ink text-[14px] font-medium hover:bg-gold-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {pending ? "Generating…" : "Generate quotation"}
          </button>
          <p className="mt-3 text-[10.5px] text-text-faint leading-relaxed">
            A preliminary measurement round is auto-created with these
            client-supplied dimensions. A real on-site round can supersede
            it later.
          </p>
        </div>
      </aside>

    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim">{k}</dt>
      <dd className="text-text text-right tabular">{v}</dd>
    </div>
  );
}
