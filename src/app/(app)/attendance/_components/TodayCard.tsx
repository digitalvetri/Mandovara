"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { selfCheckIn, selfCheckOut } from "../_actions";
import { CompactAction, StatusBadge, TimeCol } from "./TodayCardParts";

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

export const STATUS_LABEL: Record<string, string> = {
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

        {/* ── Status + current time on same row ── */}
        <div className="flex items-center justify-between mb-4">
          <StatusBadge
            notCheckedIn={notCheckedIn}
            isCheckedIn={isCheckedIn}
            isComplete={isComplete}
            isNonWorkDay={isNonWorkDay}
            status={status}
            isLocked={isLocked}
          />
          <span className="font-data tabular-nums text-[11.5px] text-text-muted">{currentTime}</span>
        </div>

        {/* ── Time columns + compact action buttons on the same row ── */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex gap-6 sm:gap-10">
            <TimeCol label="Check In"    value={inAt  ? fmtTimeISO(inAt)  : "—"} active={!!inAt}  />
            <TimeCol label="Check Out"   value={outAt ? fmtTimeISO(outAt) : "—"} active={!!outAt} />
            <TimeCol label={isComplete ? "Total Time" : "Working Time"} value={elapsed ?? "—"} active={!!elapsed} mono />
          </div>
          <CompactAction
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
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
