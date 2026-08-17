"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, CheckCircle2, AlertCircle, LogIn, LogOut,
  Loader2, Info, CalendarX,
} from "lucide-react";
import { selfCheckIn, selfCheckOut } from "../_actions";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TodayCardProps {
  dateLabel: string;           // "17 Aug 2026"
  initialInAt: string | null;  // ISO string — null if not yet punched in
  initialOutAt: string | null; // ISO string — null if not yet punched out
  initialStatus: string | null;
  isLocked: boolean;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Confirmation = { variant: "success" | "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTimeISO(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function nowTimeIST(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function elapsedLabel(inAtISO: string, outAtISO: string | null): string {
  const from = new Date(inAtISO).getTime();
  const to   = outAtISO ? new Date(outAtISO).getTime() : Date.now();
  const mins = Math.max(0, Math.floor((to - from) / 60000));
  const h    = Math.floor(mins / 60);
  const m    = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

const STATUS_LABEL: Record<string, string> = {
  LEAVE:    "On Leave",
  HOLIDAY:  "Holiday",
  WEEK_OFF: "Week Off",
  HALF_DAY: "Half Day",
  ABSENT:   "Absent",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TodayCard({
  dateLabel,
  initialInAt,
  initialOutAt,
  initialStatus,
  isLocked,
}: TodayCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Optimistic local state — mirroring DB, updated immediately on action success
  const [inAt,   setInAt]   = useState<string | null>(initialInAt);
  const [outAt,  setOutAt]  = useState<string | null>(initialOutAt);
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [currentTime,  setCurrentTime]  = useState<string>(nowTimeIST);
  const [elapsed, setElapsed] = useState<string | null>(
    initialInAt ? elapsedLabel(initialInAt, initialOutAt) : null,
  );

  // Live clock + working timer — ticks every 30s
  useEffect(() => {
    const tick = () => {
      setCurrentTime(nowTimeIST());
      if (inAt && !outAt) setElapsed(elapsedLabel(inAt, null));
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [inAt, outAt]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isNonWorkDay = status === "LEAVE" || status === "HOLIDAY" || status === "WEEK_OFF";
  const isCheckedIn  = !!inAt && !outAt && (status === "PRESENT" || status === "HALF_DAY");
  const isComplete   = !!inAt && !!outAt;
  const notCheckedIn = !inAt && !isNonWorkDay;

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleCheckIn() {
    if (pending || isLocked) return;
    setConfirmation(null);
    startTransition(async () => {
      const res = await selfCheckIn();
      if (res.ok && res.time) {
        const now = new Date().toISOString();
        setInAt(now);
        setStatus("PRESENT");
        setElapsed(elapsedLabel(now, null));
        setConfirmation({
          variant: "success",
          message: `Check-in recorded at ${res.time}.`,
        });
        router.refresh(); // refreshes calendar + history server regions
      } else {
        setConfirmation({ variant: "error", message: res.error ?? "Could not record check-in." });
      }
    });
  }

  function handleCheckOut() {
    if (pending || isLocked || !inAt) return;
    setConfirmation(null);
    startTransition(async () => {
      const res = await selfCheckOut();
      if (res.ok && res.time) {
        const now = new Date().toISOString();
        const finalWorked = res.worked ?? (inAt ? elapsedLabel(inAt, now) : "—");
        setOutAt(now);
        setElapsed(finalWorked);
        setConfirmation({
          variant: "success",
          message: `Day completed — Checked out at ${res.time}. Total: ${finalWorked}.`,
        });
        router.refresh();
      } else {
        setConfirmation({ variant: "error", message: res.error ?? "Could not record check-out." });
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mb-4 rounded-[14px] border border-border bg-surface overflow-hidden">

      {/* ── Card header ── */}
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-border/60">
        <Clock size={13} strokeWidth={2} className="text-gold" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Today&apos;s Attendance
        </span>
        <span className="ml-auto font-data tabular-nums text-[11px] text-text-subtle">
          {dateLabel}
        </span>
      </div>

      {/* ── Confirmation / error banner — persists until next action ── */}
      {confirmation && (
        <div className={[
          "flex items-start gap-2.5 px-5 py-3 text-[12.5px] leading-snug border-b border-border/30",
          confirmation.variant === "success"
            ? "bg-solid/8 text-solid"
            : "bg-fault/8 text-fault",
        ].join(" ")}>
          {confirmation.variant === "success"
            ? <CheckCircle2 size={14} strokeWidth={2} className="shrink-0 mt-0.5" />
            : <AlertCircle  size={14} strokeWidth={2} className="shrink-0 mt-0.5" />}
          <span className="font-medium">{confirmation.message}</span>
        </div>
      )}

      <div className="px-5 py-4">

        {/* ── Status badge ── */}
        <div className="mb-5">
          <StatusBadge
            notCheckedIn={notCheckedIn}
            isCheckedIn={isCheckedIn}
            isComplete={isComplete}
            isNonWorkDay={isNonWorkDay}
            status={status}
            isLocked={isLocked}
          />
        </div>

        {/* ── Time grid — 4 cells ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <TimeCell
            label="Check In"
            value={inAt ? fmtTimeISO(inAt) : "—"}
            active={!!inAt}
          />
          <TimeCell
            label="Check Out"
            value={outAt ? fmtTimeISO(outAt) : "—"}
            active={!!outAt}
          />
          <TimeCell
            label={isComplete ? "Total Time" : "Working Time"}
            value={elapsed ?? "—"}
            active={!!elapsed}
            mono
          />
          <TimeCell label="Scheduled" value="09:00 AM" muted />
        </div>

        {/* ── Footer meta ── */}
        <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-text-muted mb-5">
          <span>
            Current time:{" "}
            <span className="font-data tabular-nums text-text">{currentTime}</span>
          </span>
          {isLocked && (
            <span className="text-text-subtle flex items-center gap-1">
              🔒 Locked — contact HR to correct
            </span>
          )}
        </div>

        {/* ── Primary action area ── */}
        <ActionArea
          notCheckedIn={notCheckedIn}
          isCheckedIn={isCheckedIn}
          isComplete={isComplete}
          isNonWorkDay={isNonWorkDay}
          isLocked={isLocked}
          status={status}
          pending={pending}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
        />
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({
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

function Badge({
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

function ActionArea({
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
        className="w-full h-11 rounded-[10px] bg-heat/85 text-white text-[13.5px] font-semibold flex items-center justify-center gap-2 hover:bg-heat transition-colors active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
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

function TimeCell({
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
