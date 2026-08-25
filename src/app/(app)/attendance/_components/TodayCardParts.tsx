"use client";

// TodayCard sub-components (§10 split).

import { CheckCircle2, LogIn, LogOut, Loader2, Info, CalendarX } from "lucide-react";
import { STATUS_LABEL } from "./TodayCard";

// ── Inline time column (no background box) ────────────────────────────────────

export function TimeCol({
  label, value, active, mono,
}: {
  label: string;
  value: string;
  active?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-text-muted mb-1.5">
        {label}
      </p>
      <p className={[
        "text-[20px] sm:text-[22px] font-semibold leading-none",
        mono ? "font-data tabular-nums" : "",
        active ? "text-text" : "text-text-subtle",
      ].join(" ")}>
        {value}
      </p>
    </div>
  );
}

// ── Compact inline action buttons ─────────────────────────────────────────────

export function CompactAction({
  notCheckedIn, isCheckedIn, isComplete, isNonWorkDay,
  isLocked, status, pending, onCheckIn, onCheckOut,
}: {
  notCheckedIn: boolean;
  isCheckedIn: boolean;
  isComplete: boolean;
  isNonWorkDay: boolean;
  isLocked: boolean;
  status: string | null;
  pending: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  if (isLocked) {
    return (
      <span className="text-[12px] text-text-muted flex items-center gap-1.5 pb-0.5">
        🔒 Locked
      </span>
    );
  }
  if (isNonWorkDay) {
    return (
      <span className="text-[12px] text-text-muted flex items-center gap-1.5 pb-0.5">
        <CalendarX size={13} strokeWidth={1.8} />
        {STATUS_LABEL[status ?? ""] ?? "Non-working day"}
      </span>
    );
  }
  if (isComplete) {
    return (
      <span className="text-[12.5px] font-medium text-solid flex items-center gap-1.5 pb-0.5">
        <CheckCircle2 size={14} strokeWidth={2} />
        Day complete
      </span>
    );
  }

  const doingCheckIn  = notCheckedIn || (!isCheckedIn && !isComplete && !isNonWorkDay);
  const doingCheckOut = isCheckedIn;

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={doingCheckIn ? onCheckIn : undefined}
        disabled={pending || !doingCheckIn}
        className={[
          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] border text-[12px] font-semibold transition-colors active:scale-[0.98]",
          doingCheckIn
            ? "border-solid/50 text-solid hover:bg-solid/8 disabled:cursor-not-allowed disabled:opacity-60"
            : "border-border text-text-subtle opacity-40 cursor-default pointer-events-none",
        ].join(" ")}
      >
        {pending && doingCheckIn
          ? <Loader2 size={13} className="animate-spin" />
          : <LogIn  size={13} strokeWidth={2} />}
        Check In
      </button>
      <button
        type="button"
        onClick={doingCheckOut ? onCheckOut : undefined}
        disabled={pending || !doingCheckOut}
        className={[
          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] border text-[12px] font-semibold transition-colors active:scale-[0.98]",
          doingCheckOut
            ? "border-fault/50 text-fault hover:bg-fault/8 disabled:cursor-not-allowed disabled:opacity-60"
            : "border-border text-text-subtle opacity-40 cursor-default pointer-events-none",
        ].join(" ")}
      >
        {pending && doingCheckOut
          ? <Loader2 size={13} className="animate-spin" />
          : <LogOut size={13} strokeWidth={2} />}
        Check Out
      </button>
    </div>
  );
}

export function StatusBadge({
  notCheckedIn, isCheckedIn, isComplete, isNonWorkDay, status, isLocked,
}: {
  notCheckedIn: boolean;
  isCheckedIn: boolean;
  isComplete: boolean;
  isNonWorkDay: boolean;
  status: string | null;
  isLocked: boolean;
}) {
  if (isLocked) {
    return (
      <Badge dot="bg-text-subtle" bg="bg-surface-2 text-text-muted">
        Locked
      </Badge>
    );
  }
  if (isNonWorkDay) {
    return (
      <Badge dot="bg-gold" bg="bg-gold/12 text-gold">
        {STATUS_LABEL[status ?? ""] ?? status ?? "Non-working day"}
      </Badge>
    );
  }
  if (isComplete) {
    return (
      <Badge dot="bg-info" bg="bg-info/12 text-info">
        Day Complete
      </Badge>
    );
  }
  if (isCheckedIn) {
    return (
      <Badge dot="bg-solid animate-pulse" bg="bg-solid/12 text-solid">
        Checked In — Working
      </Badge>
    );
  }
  if (notCheckedIn) {
    return (
      <Badge dot="bg-text-subtle" bg="bg-surface-2 text-text-muted">
        Not Checked In
      </Badge>
    );
  }
  return (
    <Badge dot="bg-heat" bg="bg-heat/12 text-heat">
      {STATUS_LABEL[status ?? ""] ?? status ?? "—"}
    </Badge>
  );
}

export function Badge({
  dot, bg, children,
}: { dot: string; bg: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold ${bg}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

// ── Action area ───────────────────────────────────────────────────────────────

export function ActionArea({
  notCheckedIn, isCheckedIn, isComplete, isNonWorkDay,
  isLocked, status, pending, onCheckIn, onCheckOut,
}: {
  notCheckedIn: boolean;
  isCheckedIn: boolean;
  isComplete: boolean;
  isNonWorkDay: boolean;
  isLocked: boolean;
  status: string | null;
  pending: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  if (isLocked) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-[10px] bg-surface-2 text-[12.5px] text-text-muted">
        <Info size={13} strokeWidth={1.8} className="shrink-0 mt-0.5 text-gold" />
        Attendance is locked for this period. Contact your HR manager to make corrections.
      </div>
    );
  }

  if (isNonWorkDay) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-text-muted py-1">
        <CalendarX size={14} strokeWidth={1.8} className="text-gold shrink-0" />
        {STATUS_LABEL[status ?? ""] ?? "Non-working day"} — no action required.
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex items-center gap-2 py-2 text-[13px] font-medium text-solid">
        <CheckCircle2 size={16} strokeWidth={2} />
        Day complete — attendance recorded.
      </div>
    );
  }

  if (isCheckedIn) {
    return (
      <button
        type="button"
        onClick={onCheckOut}
        disabled={pending}
        className="w-full h-11 rounded-[10px] bg-fault text-white text-[13.5px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending
          ? <Loader2 size={16} className="animate-spin" />
          : <><LogOut size={15} strokeWidth={2} /> Check Out</>}
      </button>
    );
  }

  if (notCheckedIn) {
    return (
      <button
        type="button"
        onClick={onCheckIn}
        disabled={pending}
        className="w-full h-11 rounded-[10px] bg-solid text-white text-[13.5px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending
          ? <Loader2 size={16} className="animate-spin" />
          : <><LogIn size={15} strokeWidth={2} /> Check In</>}
      </button>
    );
  }

  // Half-day or other: allow check-in if no inAt
  return (
    <button
      type="button"
      onClick={onCheckIn}
      disabled={pending}
      className="w-full h-11 rounded-[10px] bg-solid text-white text-[13.5px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending
        ? <Loader2 size={16} className="animate-spin" />
        : <><LogIn size={15} strokeWidth={2} /> Check In</>}
    </button>
  );
}

// ── Time cell ─────────────────────────────────────────────────────────────────

export function TimeCell({
  label, value, active, muted, mono,
}: {
  label: string;
  value: string;
  active?: boolean;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-text-muted mb-1.5">
        {label}
      </p>
      <p className={[
        "text-[15px] font-semibold leading-none",
        mono ? "font-data tabular-nums" : "",
        active ? "text-text" : muted ? "text-text-muted" : "text-text-subtle",
      ].join(" ")}>
        {value}
      </p>
    </div>
  );
}
