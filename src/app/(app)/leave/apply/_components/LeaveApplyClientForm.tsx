"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, Calendar, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { selfApplyLeave } from "@/modules/hr/actions";
import {
  LEAVE_TYPES, todayStr, calcDays, fmtDate, fmtDateShort,
  type LeaveTypeValue, type Employee, type RecentLeave,
} from "../_lib/leave-types";
import { LeaveNoEmployeeFallback } from "./LeaveScreens";
import { LeaveSummaryPanel } from "./LeaveSummaryPanel";

interface Props {
  employee:     Employee | null;
  recentLeaves: RecentLeave[];
}

export function LeaveApplyClientForm({ employee, recentLeaves }: Props) {
  const [pending, start]   = useTransition();
  const router             = useRouter();
  const today              = todayStr();

  const [leaveType, setLeaveType] = useState<LeaveTypeValue>("CASUAL");
  const [fromDate,  setFrom]      = useState(today);
  const [toDate,    setTo]        = useState(today);
  const [reason,    setReason]    = useState("");
  const [error,     setError]     = useState<string | null>(null);

  const days = useMemo(() => calcDays(fromDate, toDate), [fromDate, toDate]);

  const initials = employee
    ? employee.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "";

  function handleFromChange(val: string) {
    setFrom(val);
    if (val > toDate) setTo(val);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee || days === 0) return;
    if (!reason.trim()) { setError("Please enter a reason for your leave request."); return; }
    setError(null);
    start(async () => {
      const res = await selfApplyLeave({ type: leaveType, fromDate, toDate, reason: reason.trim() });
      if (!res.ok) { setError(res.error ?? "Could not submit. Please try again."); return; }
      router.push("/leave");
    });
  }

  if (!employee) return <LeaveNoEmployeeFallback />;

  return (
    <form onSubmit={handleSubmit} className="pb-6">

      {/* Employee identity band */}
      <div className="mb-5 flex items-center gap-4 rounded-[14px] border border-rule bg-surface px-5 py-3.5">
        <div className="h-10 w-10 rounded-full border border-accent/25 bg-accent/12 flex items-center justify-center shrink-0">
          <span className="font-display text-[14px] font-semibold text-accent">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-text truncate">{employee.name}</div>
          <div className="text-[11px] text-text-dim">
            {employee.designation ?? employee.department}
            <span className="mx-1.5 opacity-30">·</span>
            <span className="font-data">{employee.code}</span>
          </div>
        </div>
        <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface-2 px-3 py-1 text-[10.5px] text-text-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-good" />
          Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Form (left 2/3) ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Leave type cards */}
          <section>
            <SectionLabel>Leave Type</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {LEAVE_TYPES.map((t) => {
                const active = leaveType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setLeaveType(t.value)}
                    aria-pressed={active}
                    style={{
                      background:  active ? t.bgHex : undefined,
                      borderColor: active ? t.rHex  : undefined,
                      boxShadow:   active ? `0 0 0 2px ${t.hex}28` : "none",
                    }}
                    className={[
                      "group relative flex flex-col items-center gap-2 rounded-[12px] border px-2 py-3 text-center",
                      "transition-all duration-150 focus-visible:outline-none",
                      active ? "" : "bg-surface border-rule",
                    ].join(" ")}
                  >
                    {active && (
                      <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full" style={{ background: t.hex }}>
                        <Check size={8} strokeWidth={3} color="#fff" />
                      </span>
                    )}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: t.bgHex }}>
                      <t.Icon size={16} strokeWidth={1.7} style={{ color: t.hex }} />
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold leading-tight" style={{ color: t.hex }} >{t.label}</div>
                      <div className="mt-0.5 text-[9px] text-text-dim leading-tight hidden sm:block">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Date range */}
          <section>
            <SectionLabel>Date Range</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <DateField label="From" value={fromDate} min={today}    onChange={handleFromChange} />
              <DateField label="To"   value={toDate}   min={fromDate} onChange={setTo} />
            </div>
            {days > 0 ? (
              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/8 px-3 py-1 text-[11.5px] font-medium text-accent">
                <Calendar size={11} strokeWidth={2} />
                {days} day{days !== 1 ? "s" : ""}
                <span className="text-text-dim font-normal">
                  {fromDate === toDate ? `· ${fmtDate(fromDate)}` : `· ${fmtDateShort(fromDate)} → ${fmtDate(toDate)}`}
                </span>
              </span>
            ) : (
              <span className="mt-2 inline-block text-[11.5px] text-text-faint italic">Select a valid date range</span>
            )}
          </section>

          {/* Reason */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel noMargin>
                Reason <span className="text-bad ml-0.5">*</span>
              </SectionLabel>
              <span className="text-[10px] text-text-faint">{reason.length} / 500</span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="Briefly tell your manager why you need this leave…"
              rows={3}
              className="w-full resize-none rounded-[11px] border border-rule bg-surface-2 px-4 py-2.5 text-[13px] text-text placeholder:text-text-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/12"
            />
          </section>
        </div>

        {/* ── Summary panel (right 1/3) ─────────────────────────────────── */}
        <LeaveSummaryPanel
          leaveType={leaveType}
          fromDate={fromDate}
          toDate={toDate}
          days={days}
          reason={reason}
          recentLeaves={recentLeaves}
        />
      </div>

      {/* ── Submit — full width below the grid, always visible ────────── */}
      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-[11px] border border-bad/25 bg-bad/8 px-4 py-3">
          <AlertCircle size={15} strokeWidth={2} className="text-bad mt-0.5 shrink-0" />
          <span className="text-[12.5px] text-bad leading-snug">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || days === 0 || !reason.trim()}
        className={[
          "mt-5 w-full h-[52px] rounded-[13px] font-semibold text-[15px]",
          "flex items-center justify-center gap-2.5 transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          "disabled:cursor-not-allowed",
          days > 0 && reason.trim()
            ? "bg-accent text-white hover:bg-accent-hover"
            : "bg-surface-hover text-text-subtle",
          pending ? "opacity-70" : "",
        ].join(" ")}
      >
        {pending ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <>
            <span>Submit Leave Request</span>
            <ArrowRight size={16} strokeWidth={2.2} />
          </>
        )}
      </button>
    </form>
  );
}

// ── Shared small components ───────────────────────────────────────────────────

function SectionLabel({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div className={`text-[10.5px] font-semibold uppercase tracking-[0.15em] text-text-dim ${noMargin ? "" : "mb-2"}`}>
      {children}
    </div>
  );
}

function DateField({ label, value, min, onChange }: {
  label: string; value: string; min: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] text-text-dim mb-1.5">{label}</label>
      <input
        type="date" value={value} min={min} required
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded-[10px] border border-rule bg-surface-2 px-3 text-[13px] text-text tabular outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/12"
      />
    </div>
  );
}
