"use client";

import { Clock } from "lucide-react";
import {
  LEAVE_TYPES, TYPE_LABEL, STATE_COLOR,
  fmtDate, fmtDateShort,
  type LeaveTypeValue, type RecentLeave,
} from "../_lib/leave-types";

interface Props {
  leaveType:    LeaveTypeValue;
  fromDate:     string;
  toDate:       string;
  days:         number;
  reason:       string;
  recentLeaves: RecentLeave[];
}

export function LeaveSummaryPanel({ leaveType, fromDate, toDate, days, reason, recentLeaves }: Props) {
  const selectedType = LEAVE_TYPES.find((t) => t.value === leaveType)!;

  return (
    <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">

      {/* Live summary card */}
      <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
        <div className="px-4 py-3.5 border-b border-rule" style={{ background: selectedType.bgHex }}>
          <div className="flex items-center gap-2">
            <selectedType.Icon size={13} strokeWidth={2} style={{ color: selectedType.hex }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em]" style={{ color: selectedType.hex }}>
              {selectedType.label} Leave
            </span>
          </div>
        </div>
        <div className="px-4 py-4 divide-y divide-rule/50">
          <SummaryRow label="Duration">
            <strong className="text-text">{days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "—"}</strong>
          </SummaryRow>
          <SummaryRow label="From">
            <span className="tabular text-text">{days > 0 ? fmtDate(fromDate) : "—"}</span>
          </SummaryRow>
          {fromDate !== toDate && days > 0 && (
            <SummaryRow label="To">
              <span className="tabular text-text">{fmtDate(toDate)}</span>
            </SummaryRow>
          )}
          {reason.trim() && (
            <SummaryRow label="Reason">
              <span className="text-text-dim text-right max-w-[130px] truncate" title={reason}>{reason.trim()}</span>
            </SummaryRow>
          )}
          <SummaryRow label="Status">
            <span className="inline-flex items-center gap-1 rounded-full border border-heat/25 bg-heat/10 px-2 py-0.5 text-[10.5px] font-medium text-heat">
              <Clock size={9} strokeWidth={2.5} />
              Awaiting approval
            </span>
          </SummaryRow>
        </div>
      </div>

      {/* Recent leave history */}
      {recentLeaves.length > 0 && (
        <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-text-dim">Recent Requests</span>
          </div>
          <ul>
            {recentLeaves.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule/50 last:border-0">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-text truncate">{TYPE_LABEL[l.type] ?? l.type}</div>
                  <div className="text-[10.5px] text-text-dim tabular">
                    {fmtDateShort(l.fromDate)}
                    {l.fromDate !== l.toDate && ` – ${fmtDateShort(l.toDate)}`}
                    <span className="ml-1 text-text-faint">({l.days}d)</span>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: STATE_COLOR[l.state] ?? "var(--text-dim)" }}>
                  {l.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-text-faint leading-relaxed px-1">
        Leave requests go to your manager for approval. You&apos;ll see the status update on your dashboard.
      </p>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[11.5px] text-text-dim">{label}</span>
      <div className="text-[12.5px]">{children}</div>
    </div>
  );
}
