"use client";

import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Clock, ArrowRight, AlertCircle } from "lucide-react";
import { fmtDate, fmtDateShort, type LeaveTypeValue } from "../_lib/leave-types";
import { LEAVE_TYPES } from "../_lib/leave-types";

// ── Success screen shown after a leave request is submitted ───────────────────

interface SuccessProps {
  leaveType:  LeaveTypeValue;
  days:       number;
  fromDate:   string;
  toDate:     string;
  onReset:    () => void;
}

export function LeaveSuccessScreen({ leaveType, days, fromDate, toDate, onReset }: SuccessProps) {
  const selectedType = LEAVE_TYPES.find((t) => t.value === leaveType)!;

  return (
    <div className="mt-12 max-w-sm mx-auto text-center">
      <div className="relative flex h-24 w-24 items-center justify-center mx-auto mb-6">
        <div className="absolute inset-0 rounded-full bg-good/10 animate-ping" style={{ animationDuration: "1.5s" }} />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-good/15 border-2 border-good/30">
          <CheckCircle2 size={40} strokeWidth={1.4} className="text-good" />
        </div>
      </div>

      <h2 className="font-display text-[24px] font-[560] text-text mb-2">Request Submitted</h2>
      <p className="text-[13px] text-text-dim leading-relaxed mb-1">
        Your <span className="font-semibold text-text">{selectedType.label} leave</span> for{" "}
        <span className="font-semibold text-text">{days} day{days !== 1 ? "s" : ""}</span>
      </p>
      <p className="text-[12.5px] text-text-dim mb-6">
        {fromDate === toDate ? fmtDate(fromDate) : `${fmtDateShort(fromDate)} – ${fmtDate(toDate)}`}
      </p>

      <div className="inline-flex items-center gap-2 rounded-full border border-heat/20 bg-heat/8 px-4 py-2 text-[12.5px] font-medium text-heat mb-8">
        <Clock size={13} strokeWidth={2} />
        Awaiting approval
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onReset}
          className="flex-1 h-11 rounded-[11px] border border-rule bg-surface-2 text-[13px] font-medium text-text hover:bg-surface-hover transition-colors"
        >
          Apply Another
        </button>
        <Link
          href={"/employee" as Route}
          className="flex-1 h-11 rounded-[11px] bg-accent text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors"
        >
          Back to Dashboard
          <ArrowRight size={14} strokeWidth={2.2} />
        </Link>
      </div>
    </div>
  );
}

// ── Shown when no employee record is linked to the user ───────────────────────

export function LeaveNoEmployeeFallback() {
  return (
    <div className="mt-10 max-w-md mx-auto rounded-[18px] border border-rule bg-surface p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-heat/10 mx-auto mb-4">
        <AlertCircle size={26} strokeWidth={1.6} className="text-heat" />
      </div>
      <h2 className="font-display text-[17px] font-[560] text-text mb-2">Profile not linked</h2>
      <p className="text-[12.5px] text-text-dim leading-relaxed">
        Your user account is not linked to an employee record yet.
        Contact HR to complete the setup before applying for leave.
      </p>
      <Link
        href={"/employee" as Route}
        className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-surface-2 border border-rule px-4 py-2.5 text-[12.5px] font-medium text-text hover:bg-surface-hover transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
