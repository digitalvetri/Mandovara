"use client";

// Leave requests, expandable.
//
// The card listed name, type, days and dates, then offered Approve and
// Reject — with the employee's reason nowhere on the page. An admin was
// being asked to decide without the one piece of information the
// decision turns on (owner, 2026-08-29). Clicking a request now opens it
// downwards to show the reason, with the actions inside that area.
//
// Pending requests start open: they are the ones needing a decision, and
// making someone click every row to find out why is the same problem in
// a new shape. Decided ones start closed.

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LeaveRow } from "@/modules/attendance/queries";
import { LeaveApprovalButtons } from "@/app/(app)/leave/_components/LeaveApprovalButtons";

const LEAVE_TONE: Record<string, string> = {
  APPROVED: "bg-solid/12 text-solid",
  PENDING:  "bg-heat/15 text-heat",
  REJECTED: "bg-fault/12 text-fault",
};

export function LeaveRequestList({ leaves }: { leaves: LeaveRow[] }) {
  if (leaves.length === 0) {
    return <p className="text-[13px] text-text-dim">No leave requests.</p>;
  }
  return (
    <ul className="space-y-2">
      {leaves.map((l) => <LeaveItem key={l.id} leave={l} />)}
    </ul>
  );
}

function LeaveItem({ leave: l }: { leave: LeaveRow }) {
  const [open, setOpen] = useState(l.state === "PENDING");

  return (
    <li className="rounded-[10px] border border-rule/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2/40"
      >
        <span className="mt-0.5 text-text-dim">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[13.5px] text-text">{l.employeeName}</span>
            <span className={`rounded-[4px] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${LEAVE_TONE[l.state] ?? ""}`}>
              {l.state.charAt(0) + l.state.slice(1).toLowerCase()}
            </span>
          </span>
          <span className="mt-0.5 block text-[12.5px] text-text-dim">
            {l.kind} · {l.days} day{l.days === 1 ? "" : "s"} · {l.when}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-rule/70 px-3 py-3">
          <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-text-faint">Reason</div>
          <p className="mb-3 text-[13px] text-text">
            {l.reason?.trim() ? l.reason : <span className="text-text-dim">No reason given.</span>}
          </p>
          {l.state === "PENDING" && <LeaveApprovalButtons id={l.id} />}
        </div>
      )}
    </li>
  );
}
