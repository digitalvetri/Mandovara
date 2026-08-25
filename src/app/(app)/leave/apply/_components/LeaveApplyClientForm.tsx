"use client";

import { useState, useTransition, useMemo } from "react";
import { Check, Calendar, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { selfApplyLeave } from "@/modules/hr/actions";
import { LEAVE_TYPES, todayStr, calcDays, fmtDate, fmtDateShort, type LeaveTypeValue, type Employee, type RecentLeave } from "../_lib/leave-types";
import { LeaveSuccessScreen, LeaveNoEmployeeFallback } from "./LeaveScreens";
import { LeaveSummaryPanel } from "./LeaveSummaryPanel";

interface Props {
  employee:     Employee | null;
  recentLeaves: RecentLeave[];
}

export function LeaveApplyClientForm({ employee, recentLeaves }: Props) {
  const [pending, start]   = useTransition();
  const today              = todayStr();

  const [leaveType, setLeaveType] = useState<LeaveTypeValue>("CASUAL");
  const [fromDate,  setFrom]      = useState(today);
  const [toDate,    setTo]        = useState(today);
  const [reason,    setReason]    = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const days = useMemo(() => calcDays(fromDate, toDate), [fromDate, toDate]);

  const initials = employee
    ? employee.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "";

  function handleFromChange(val: string) {
    setFrom(val);
    if (val > toDate) setTo(val);
  }

  function handleReset() {
    setSubmitted(false); setReason(""); setFrom(today); setTo(today);
    setLeaveType("CASUAL"); setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee || days === 0) return;
    setError(null);
    start(async () => {
      const res = await selfApplyLeave({ type: leaveType, fromDate, toDate, reason: reason.trim() || undefined });
      if (!res.ok) { setError(res.error ?? "Could not submit. Please try again."); return; }
      setSubmitted(true);
    });
  }

  if (!employee) return <LeaveNoEmployeeFallback />;

  if (submitted) {
    return (
      <LeaveSuccessScreen
        leaveType={leaveType}
        days={days}
        fromDate={fromDate}
        toDate={toDate}
        onReset={handleReset}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="pb-12">

      {/* Employee identity band */}
      <div className="mb-6 flex items-center gap-4 rounded-[14px] border border-rule bg-surface px-5 py-4">
        <div className="h-11 w-11 rounded-full border border-accent/25 bg-accent/12 flex items-center justify-center shrink-0">
          <span className="font-display text-[15px] font-semibold text-accent">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-text truncate">{employee.name}</div>
          <div className="text-[11.5px] text-text-dim">
            {employee.designation ?? employee.department}
            <span className="mx-1.5 opacity-30">·</span>
            <span className="font-data">{employee.code}</span>
          </div>
        </div>
        <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface-2 px-3 py-1.5 text-[11px] text-text-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-good" />
          Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Form (left 2/3) ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-7">

          {/* Leave type cards */}
          <section>
            <SectionLabel>Leave Type</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {LEAVE_TYPES.map((t) => {
                const active = leaveType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setLeaveType(t.value)}
                    aria-pressed={active}
                    className="group relative flex flex-col items-center gap-2.5 rounded-[13px] border px-3 py-4 text-center transition-all duration-150 focus-visible:outline-none"
                    style={{ background: active ? t.bgHex : "var(--surface)", borderColor: active ? t.rHex : "var(--rule)", boxShadow: active ? `0 0 0 2.5px ${t.hex}28` : "none" }}
                  >
                    {active && (
                      <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full" style={{ background: t.hex }}>
                        <Check size={9} strokeWidth={3} color="#fff" />
                      </span>
                    )}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-150 group-active:scale-90" style={{ background: t.bgHex }}>
                      <t.Icon size={18} strokeWidth={1.7} style={{ color: t.hex }} />
                    </div>
                    <div>
                      <div className="text-[12.5px] font-semibold leading-tight" style={{ color: active ? t.hex : "var(--text)" }}>{t.label}</div>
                      <div className="mt-0.5 text-[9.5px] text-text-dim leading-tight hidden sm:block">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Date range */}
          <section>
            <SectionLabel>Date Range</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <DateField label="From" value={fromDate} min={today}     onChange={handleFromChange} />
              <DateField label="To"   value={toDate}   min={fromDate}  onChange={setTo} />
            </div>
            <div className="mt-3">
              {days > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/8 px-3.5 py-1.5 text-[12px] font-medium text-accent">
                  <Calendar size={12} strokeWidth={2} />
                  {days} day{days !== 1 ? "s" : ""}
                  <span className="text-text-dim font-normal">
                    {fromDate === toDate ? `· ${fmtDate(fromDate)}` : `· ${fmtDateShort(fromDate)} → ${fmtDate(toDate)}`}
                  </span>
                </span>
              ) : (
                <span className="text-[12px] text-text-faint italic">Select a valid date range</span>
              )}
            </div>
          </section>

          {/* Reason */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <SectionLabel noMargin>
                Reason <span className="text-text-faint font-normal normal-case tracking-normal ml-0.5">(optional)</span>
              </SectionLabel>
              <span className="text-[10.5px] text-text-faint tabular">{reason.length} / 500</span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="Briefly tell your manager why you need this leave…"
              rows={4}
              className="w-full resize-none rounded-[12px] border border-rule bg-surface-2 px-4 py-3 text-[13.5px] text-text placeholder:text-text-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/12"
            />
          </section>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-[11px] border border-bad/25 bg-bad/8 px-4 py-3">
              <AlertCircle size={15} strokeWidth={2} className="text-bad mt-0.5 shrink-0" />
              <span className="text-[12.5px] text-bad leading-snug">{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={pending || days === 0}
            className="group w-full h-[52px] rounded-[13px] font-semibold text-[14.5px] flex items-center justify-center gap-2.5 transition-all duration-150 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            style={{ background: days > 0 ? "var(--accent)" : "var(--surface-hover)", color: days > 0 ? "#fff" : "var(--text-subtle)", opacity: pending ? 0.7 : 1 }}
          >
            {pending ? <Loader2 size={18} className="animate-spin" /> : (
              <>
                <span>Submit Leave Request</span>
                <ArrowRight size={16} strokeWidth={2.2} className="transition-transform duration-150 group-hover:translate-x-[3px]" />
              </>
            )}
          </button>
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
    </form>
  );
}

// ── Shared small components ───────────────────────────────────────────────────

function SectionLabel({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div className={`text-[10.5px] font-semibold uppercase tracking-[0.15em] text-text-dim ${noMargin ? "" : "mb-2.5"}`}>
      {children}
    </div>
  );
}

function DateField({ label, value, min, onChange }: { label: string; value: string; min: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] text-text-dim mb-1.5">{label}</label>
      <input
        type="date" value={value} min={min} required
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-[10px] border border-rule bg-surface-2 px-3 text-[13.5px] text-text tabular outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/12"
      />
    </div>
  );
}
