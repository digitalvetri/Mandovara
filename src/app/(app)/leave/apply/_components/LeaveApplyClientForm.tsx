"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Sun, Thermometer, Star, RefreshCw, MinusCircle,
  CheckCircle2, Calendar, ArrowRight, Loader2, Clock, AlertCircle,
  Check,
} from "lucide-react";
import { selfApplyLeave } from "@/modules/hr/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type LeaveTypeValue = "CASUAL" | "SICK" | "EARNED" | "COMP_OFF" | "UNPAID";

interface Employee {
  id: string;
  name: string;
  designation: string | null;
  department:  string | null;
  code:        string;
}

interface RecentLeave {
  id:       string;
  type:     string;
  fromDate: string;
  toDate:   string;
  days:     number;
  state:    string;
}

interface Props {
  employee:     Employee | null;
  recentLeaves: RecentLeave[];
}

// ── Leave type definitions ────────────────────────────────────────────────────

const LEAVE_TYPES = [
  {
    value:  "CASUAL"  as const,
    label:  "Casual",
    desc:   "Personal errands & day-offs",
    Icon:   Sun,
    hex:    "#F59E0B",
    bgHex:  "rgba(245,158,11,0.12)",
    rHex:   "rgba(245,158,11,0.30)",
  },
  {
    value:  "SICK"    as const,
    label:  "Sick",
    desc:   "Medical or health reasons",
    Icon:   Thermometer,
    hex:    "#EF4444",
    bgHex:  "rgba(239,68,68,0.10)",
    rHex:   "rgba(239,68,68,0.30)",
  },
  {
    value:  "EARNED"  as const,
    label:  "Earned",
    desc:   "Accrued paid leave",
    Icon:   Star,
    hex:    "#8B5CF6",
    bgHex:  "rgba(139,92,246,0.10)",
    rHex:   "rgba(139,92,246,0.30)",
  },
  {
    value:  "COMP_OFF" as const,
    label:  "Comp-off",
    desc:   "Compensatory time off",
    Icon:   RefreshCw,
    hex:    "#3B82F6",
    bgHex:  "rgba(59,130,246,0.10)",
    rHex:   "rgba(59,130,246,0.30)",
  },
  {
    value:  "UNPAID"  as const,
    label:  "Unpaid",
    desc:   "Leave without pay",
    Icon:   MinusCircle,
    hex:    "#94A3B8",
    bgHex:  "rgba(148,163,184,0.10)",
    rHex:   "rgba(148,163,184,0.28)",
  },
] as const;

const TYPE_LABEL: Record<string, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned", COMP_OFF: "Comp-off", UNPAID: "Unpaid",
};

const STATE_COLOR: Record<string, string> = {
  PENDING:  "#F59E0B",
  APPROVED: "#10B981",
  REJECTED: "#EF4444",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function calcDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  if (diff < 0) return 0;
  return Math.round(diff / 86_400_000) + 1;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export function LeaveApplyClientForm({ employee, recentLeaves }: Props) {
  const [pending, start]   = useTransition();
  const today              = todayStr();

  const [leaveType, setLeaveType] = useState<LeaveTypeValue>("CASUAL");
  const [fromDate,  setFrom]      = useState(today);
  const [toDate,    setTo]        = useState(today);
  const [reason,    setReason]    = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const days         = useMemo(() => calcDays(fromDate, toDate), [fromDate, toDate]);
  const selectedType = LEAVE_TYPES.find((t) => t.value === leaveType)!;

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
    setError(null);
    start(async () => {
      const res = await selfApplyLeave({
        type:     leaveType,
        fromDate,
        toDate,
        reason:   reason.trim() || undefined,
      });
      if (!res.ok) { setError(res.error ?? "Could not submit. Please try again."); return; }
      setSubmitted(true);
    });
  }

  // ── No employee linked ─────────────────────────────────────────────────────
  if (!employee) {
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

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="mt-12 max-w-sm mx-auto text-center">
        {/* Animated checkmark */}
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
          {fromDate === toDate
            ? fmtDate(fromDate)
            : `${fmtDateShort(fromDate)} – ${fmtDate(toDate)}`}
        </p>

        {/* Status pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-heat/20 bg-heat/8 px-4 py-2 text-[12.5px] font-medium text-heat mb-8">
          <Clock size={13} strokeWidth={2} />
          Awaiting approval
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              setSubmitted(false);
              setReason("");
              setFrom(today);
              setTo(today);
              setLeaveType("CASUAL");
              setError(null);
            }}
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

  // ── Main form ──────────────────────────────────────────────────────────────
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

        {/* ── Left column — the actual form ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-7">

          {/* Leave type picker */}
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
                    className="group relative flex flex-col items-center gap-2.5 rounded-[13px] border px-3 py-4 text-center transition-all duration-150 focus-visible:outline-none"
                    style={{
                      background:  active ? t.bgHex  : "var(--surface)",
                      borderColor: active ? t.rHex   : "var(--rule)",
                      boxShadow:   active ? `0 0 0 2.5px ${t.hex}28` : "none",
                    }}
                    aria-pressed={active}
                  >
                    {active && (
                      <span
                        className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full"
                        style={{ background: t.hex }}
                      >
                        <Check size={9} strokeWidth={3} color="#fff" />
                      </span>
                    )}
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-150 group-active:scale-90"
                      style={{ background: t.bgHex }}
                    >
                      <t.Icon size={18} strokeWidth={1.7} style={{ color: t.hex }} />
                    </div>
                    <div>
                      <div
                        className="text-[12.5px] font-semibold leading-tight"
                        style={{ color: active ? t.hex : "var(--text)" }}
                      >
                        {t.label}
                      </div>
                      <div className="mt-0.5 text-[9.5px] text-text-dim leading-tight hidden sm:block">
                        {t.desc}
                      </div>
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
              <DateField
                label="From"
                value={fromDate}
                min={today}
                onChange={handleFromChange}
              />
              <DateField
                label="To"
                value={toDate}
                min={fromDate}
                onChange={setTo}
              />
            </div>
            {/* Live day count */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {days > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/8 px-3.5 py-1.5 text-[12px] font-medium text-accent">
                  <Calendar size={12} strokeWidth={2} />
                  {days} day{days !== 1 ? "s" : ""}
                  <span className="text-text-dim font-normal">
                    {fromDate === toDate
                      ? `· ${fmtDate(fromDate)}`
                      : `· ${fmtDateShort(fromDate)} → ${fmtDate(toDate)}`}
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
                Reason{" "}
                <span className="text-text-faint font-normal normal-case tracking-normal ml-0.5">
                  (optional)
                </span>
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

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-[11px] border border-bad/25 bg-bad/8 px-4 py-3">
              <AlertCircle size={15} strokeWidth={2} className="text-bad mt-0.5 shrink-0" />
              <span className="text-[12.5px] text-bad leading-snug">{error}</span>
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={pending || days === 0}
            className="group w-full h-[52px] rounded-[13px] font-semibold text-[14.5px] flex items-center justify-center gap-2.5 transition-all duration-150 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            style={{
              background: days > 0 ? "var(--accent)" : "var(--surface-hover)",
              color:      days > 0 ? "#fff"          : "var(--text-subtle)",
              opacity:    pending  ? 0.7              : 1,
            }}
          >
            {pending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>Submit Leave Request</span>
                <ArrowRight
                  size={16}
                  strokeWidth={2.2}
                  className="transition-transform duration-150 group-hover:translate-x-[3px]"
                />
              </>
            )}
          </button>
        </div>

        {/* ── Right column — summary + history ──────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">

          {/* Live summary card */}
          <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
            <div
              className="px-4 py-3.5 border-b border-rule"
              style={{ background: selectedType.bgHex }}
            >
              <div className="flex items-center gap-2">
                <selectedType.Icon size={13} strokeWidth={2} style={{ color: selectedType.hex }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.13em]" style={{ color: selectedType.hex }}>
                  {selectedType.label} Leave
                </span>
              </div>
            </div>
            <div className="px-4 py-4 divide-y divide-rule/50">
              <SummaryRow label="Duration">
                <strong className="text-text">
                  {days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "—"}
                </strong>
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
                  <span className="text-text-dim text-right max-w-[130px] truncate" title={reason}>
                    {reason.trim()}
                  </span>
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

          {/* Recent leave requests */}
          {recentLeaves.length > 0 && (
            <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-rule">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-text-dim">
                  Recent Requests
                </span>
              </div>
              <ul>
                {recentLeaves.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule/50 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-text truncate">
                        {TYPE_LABEL[l.type] ?? l.type}
                      </div>
                      <div className="text-[10.5px] text-text-dim tabular">
                        {fmtDateShort(l.fromDate)}
                        {l.fromDate !== l.toDate && ` – ${fmtDateShort(l.toDate)}`}
                        <span className="ml-1 text-text-faint">({l.days}d)</span>
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em]"
                      style={{ color: STATE_COLOR[l.state] ?? "var(--text-dim)" }}
                    >
                      {l.state}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Help note */}
          <p className="text-[11px] text-text-faint leading-relaxed px-1">
            Leave requests go to your manager for approval. You'll see the status update on your dashboard.
          </p>
        </div>
      </div>
    </form>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div className={`text-[10.5px] font-semibold uppercase tracking-[0.15em] text-text-dim ${noMargin ? "" : "mb-2.5"}`}>
      {children}
    </div>
  );
}

function DateField({
  label, value, min, onChange,
}: { label: string; value: string; min: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] text-text-dim mb-1.5">{label}</label>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full h-11 rounded-[10px] border border-rule bg-surface-2 px-3 text-[13.5px] text-text tabular outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/12"
      />
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
