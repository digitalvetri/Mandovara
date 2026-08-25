"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Wifi, WifiOff, Clock, MapPin, CheckCircle2, Loader2, AlertCircle,
  ArrowLeft, ChevronRight, RefreshCw,
} from "lucide-react";
import {
  enqueuePunch, attendanceCuid, countPendingPunches,
  type PunchType,
} from "@/lib/attendance-outbox";
import { attachAttendanceDrainListeners } from "@/lib/attendance-drain";

interface TodayAttendance {
  id:     string;
  status: string;
  inAt:   string | null;
  outAt:  string | null;
  locked: boolean;
}

interface Props {
  employee:   { id: string; name: string };
  attendance: TodayAttendance | null;
}

interface LocalState {
  inAt:   string | null;
  outAt:  string | null;
  locked: boolean;
}

const IST_OPTS: Intl.DateTimeFormatOptions = {
  hour:     "2-digit",
  minute:   "2-digit",
  timeZone: "Asia/Kolkata",
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", IST_OPTS);
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    timeZone: "Asia/Kolkata",
  });
}

export function AttendancePWA({ employee, attendance }: Props) {
  const [local, setLocal] = useState<LocalState>({
    inAt:   attendance?.inAt   ?? null,
    outAt:  attendance?.outAt  ?? null,
    locked: attendance?.locked ?? false,
  });
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending]   = useState(0);
  const [gpsWarn, setGpsWarn]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Online / offline
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Drain listener — runs once on mount, fires on online / visible
  useEffect(() => {
    const dispose = attachAttendanceDrainListeners((summary) => {
      setPending(summary.remaining);
      if (summary.sent > 0) {
        setLastSync(
          new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
        );
      }
    });
    countPendingPunches().then(setPending);
    return dispose;
  }, []);

  const handlePunch = useCallback(async (type: PunchType) => {
    setLoading(true);
    setGpsWarn(null);

    let lat: number | undefined;
    let lng: number | undefined;

    // GPS — non-blocking; punch is recorded even if location unavailable
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8_000, maximumAge: 60_000, enableHighAccuracy: false,
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      setGpsWarn("Location unavailable — punch recorded without GPS.");
    }

    const id        = attendanceCuid();
    const timestamp = new Date().toISOString();

    await enqueuePunch({ id, type, timestamp, lat, lng });

    setLocal((prev) => ({
      ...prev,
      inAt:  type === "in"  ? timestamp : prev.inAt,
      outAt: type === "out" ? timestamp : prev.outAt,
    }));

    countPendingPunches().then(setPending);
    setLoading(false);
  }, []);

  const hasPunchIn  = !!local.inAt;
  const hasPunchOut = !!local.outAt;
  const nextType: PunchType = hasPunchIn ? "out" : "in";
  const actionDone = local.locked || (hasPunchIn && hasPunchOut);

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* ── Top nav bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rule bg-surface">
        <Link
          href="/employee"
          className="inline-flex items-center gap-1.5 text-[13px] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Dashboard
        </Link>
        <span className="text-[13px] font-semibold text-text">Mark Attendance</span>
        {/* Connectivity status (right-aligned) */}
        <div className="flex items-center gap-1.5 text-[12px]">
          {isOnline ? (
            <span className="flex items-center gap-1 text-solid">
              <Wifi size={12} strokeWidth={2} />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-fault">
              <WifiOff size={12} strokeWidth={2} />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* ── Pending sync banner ───────────────────────────────────── */}
      {pending > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-heat/8 border-b border-heat/20 text-[12px]">
          <span className="flex items-center gap-2 text-heat">
            <RefreshCw size={12} strokeWidth={2} className={isOnline ? "animate-spin" : ""} />
            {pending} punch{pending !== 1 ? "es" : ""} queued
            {isOnline ? " — syncing…" : " — will sync when back online"}
          </span>
          {lastSync && (
            <span className="text-text-faint tabular-nums">Last synced {lastSync}</span>
          )}
        </div>
      )}

      {/* ── Main content — centered, capped width on desktop ─────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-7 w-full max-w-sm mx-auto">

        {/* Employee + date */}
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-dim">
            {todayLabel()}
          </p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold tracking-[-0.015em] text-text leading-snug">
            {employee.name}
          </h1>
        </div>

        {/* Punch times card */}
        {(hasPunchIn || hasPunchOut) && (
          <div className="w-full divide-y divide-rule/50 rounded-[14px] border border-rule bg-surface-2 text-[13px] overflow-hidden">
            {hasPunchIn && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-2 text-text-dim">
                  <Clock size={14} strokeWidth={1.8} />
                  Punch in
                </span>
                <span className="font-data tabular-nums text-solid font-medium">
                  {fmtTime(local.inAt!)}
                </span>
              </div>
            )}
            {hasPunchOut && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-2 text-text-dim">
                  <Clock size={14} strokeWidth={1.8} />
                  Punch out
                </span>
                <span className="font-data tabular-nums text-fault font-medium">
                  {fmtTime(local.outAt!)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* GPS warning */}
        {gpsWarn && (
          <p className="flex items-start gap-1.5 text-[12px] text-heat text-center leading-snug">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            {gpsWarn}
          </p>
        )}

        {/* Action */}
        {local.locked ? (
          <div className="w-full rounded-[14px] border border-rule bg-surface-2 px-5 py-4 text-center">
            <CheckCircle2 size={22} className="text-solid mx-auto mb-2" />
            <p className="text-[13px] font-medium text-text">Attendance locked</p>
            <p className="mt-0.5 text-[12px] text-text-dim">Your attendance for today has been finalised by HR.</p>
          </div>
        ) : hasPunchIn && hasPunchOut ? (
          <div className="w-full rounded-[14px] border border-solid/25 bg-solid/8 px-5 py-4 text-center">
            <CheckCircle2 size={22} className="text-solid mx-auto mb-2" />
            <p className="text-[13px] font-semibold text-solid">All done for today!</p>
            <p className="mt-0.5 text-[12px] text-text-dim">
              In at {fmtTime(local.inAt!)} · Out at {fmtTime(local.outAt!)}
            </p>
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => handlePunch(nextType)}
            className={[
              "w-full min-h-[60px] rounded-[14px] text-[16px] font-semibold",
              "flex items-center justify-center gap-3 transition-all active:scale-[0.98]",
              nextType === "in"
                ? "bg-accent text-white hover:bg-accent-hover"
                : "bg-bad/10 border border-bad/25 text-bad hover:bg-bad/18",
              "disabled:opacity-60 disabled:pointer-events-none",
            ].join(" ")}
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <MapPin size={18} strokeWidth={1.8} />
                {nextType === "in" ? "Punch In" : "Punch Out"}
              </>
            )}
          </button>
        )}

        {/* After action — quick links ───────────────────────────── */}
        {actionDone && (
          <div className="w-full space-y-2">
            <Link
              href="/attendance"
              className="flex items-center justify-between w-full rounded-[11px] border border-rule bg-surface-2 px-4 py-3 text-[13px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
            >
              <span>View my attendance history</span>
              <ChevronRight size={15} strokeWidth={2} />
            </Link>
            <Link
              href="/leave/apply"
              className="flex items-center justify-between w-full rounded-[11px] border border-rule bg-surface-2 px-4 py-3 text-[13px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
            >
              <span>Apply for leave</span>
              <ChevronRight size={15} strokeWidth={2} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
