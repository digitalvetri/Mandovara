"use client";

// Simplified follow-up task list matching the "Follow-up Management"
// reference: checkbox on the left to mark done, task text, linked-to
// tag, owner, due date. §11 acceptance still applies — the checkbox
// opens an inline outcome picker so we never close without one.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Check } from "lucide-react";
import { formatDate } from "@/kernel/datetime";
import { completeFollowUp } from "@/modules/followups/actions";
import { FOLLOWUP_OUTCOMES, type FollowUpOutcome } from "@/modules/followups/schema";
import type { FollowUpRow } from "@/modules/followups/queries";

const OUTCOME_LABEL: Record<FollowUpOutcome, string> = {
  CONTACTED: "Contacted", NO_ANSWER: "No answer", RESCHEDULED: "Rescheduled",
  CONVERTED: "Converted", LOST: "Lost",
};

export function FollowUpsTable({ rows }: { rows: FollowUpRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">Nothing sits idle yet.</div>
        <p className="text-[12px] text-text-dim">
          Every lead conversation, quote reminder and site call goes here. →{" "}
          <Link href={"/followups/new" as Route} className="text-accent hover:underline">
            Schedule the first one
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              <th className="pl-4 h-[36px] w-[36px]"></th>
              <Th>Task</Th>
              <Th>Linked to</Th>
              <Th>Owner</Th>
              <Th>Due</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <Row key={r.id} r={r} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ r }: { r: FollowUpRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickingOutcome, setPickingOutcome] = useState(false);
  const [outcome, setOutcome] = useState<FollowUpOutcome | "">("");
  const [err, setErr] = useState<string | null>(null);

  const done = r.status === "COMPLETED";
  const overdue = !done && r.daysOverdue > 0;

  function toggleCheck() {
    if (done) return;
    setPickingOutcome(true);
  }

  function commit() {
    if (!outcome) { setErr("Pick an outcome first"); return; }
    setErr(null);
    startTransition(async () => {
      const res = await completeFollowUp({ id: r.id, outcome });
      if (!res.ok) { setErr(res.error ?? "Could not close"); return; }
      setPickingOutcome(false);
      router.refresh();
    });
  }

  const target = r.leadId ? { href: `/leads/${r.leadId}` as Route,
                              tag: "Lead",   label: r.leadName ?? "—" }
              : r.clientId ? { href: `/clients/${r.clientId}` as Route,
                               tag: "Client", label: r.clientName ?? "—" }
              : r.quotationId ? { href: `/quotations/${r.quotationId}` as Route,
                                  tag: "Quote", label: r.quotationNumber ?? "—" }
              : null;

  const dueLabel = done
    ? (r.completedAt ? `Done ${formatDate(r.completedAt)}` : "Done")
    : r.daysOverdue > 0 ? `Overdue ${r.daysOverdue}d`
    : humaneDue(r.dueAt);

  return (
    <>
      <tr className={[
        "border-b border-rule/60 last:border-0 align-middle transition-colors",
        done && "bg-bg/40",
        !done && "hover:bg-surface-hover",
      ].filter(Boolean).join(" ")}>
        <td className="pl-4 h-[52px] w-[36px]">
          <button
            type="button"
            onClick={toggleCheck}
            disabled={done || pending}
            aria-label={done ? "Completed" : "Mark done"}
            className={[
              "h-5 w-5 grid place-items-center rounded-[4px] border transition-colors",
              done
                ? "bg-good border-good text-white"
                : "bg-white/60 border-rule text-transparent hover:border-accent hover:text-accent",
            ].join(" ")}
          >
            <Check size={12} strokeWidth={2.5} />
          </button>
        </td>
        <Td>
          <div className={done ? "text-text-dim line-through" : "text-text"}>
            {r.note ?? "Follow up"}
          </div>
          {r.outcome && done && (
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-good mt-0.5">
              {OUTCOME_LABEL[r.outcome as FollowUpOutcome] ?? r.outcome}
            </div>
          )}
        </Td>
        <Td>
          {target ? (
            <>
              <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mr-1">{target.tag}</span>
              <Link href={target.href} className="text-text hover:text-accent">
                · {target.label}
              </Link>
            </>
          ) : (
            <span className="text-text-faint">—</span>
          )}
        </Td>
        <Td className="text-text-dim">{r.ownerName}</Td>
        <Td>
          <span className={overdue ? "tabular text-bad" : "tabular text-text-dim"}>
            {dueLabel}
          </span>
        </Td>
      </tr>
      {pickingOutcome && (
        <tr className="border-b border-rule/60 bg-surface-hover">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Outcome</span>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value as FollowUpOutcome)}
                      className="h-[28px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent">
                <option value="">— pick outcome —</option>
                {FOLLOWUP_OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
              </select>
              <button type="button" onClick={commit} disabled={pending || !outcome}
                      className="h-[28px] px-3 rounded-[6px] bg-good text-white text-[11.5px] font-medium disabled:opacity-40">
                {pending ? "Closing…" : "Close"}
              </button>
              <button type="button" onClick={() => setPickingOutcome(false)}
                      className="h-[28px] px-2 text-[11.5px] text-text-dim hover:text-text">
                Cancel
              </button>
              {err && <span className="text-[11.5px] text-bad">{err}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function humaneDue(d: Date): string {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const dCopy = new Date(d);   dCopy.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((dCopy.getTime() - today.getTime()) / 86_400_000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Tomorrow";
  return formatDate(d);
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 h-[36px] font-medium text-left">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}
