"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Wifi, WifiOff, Clock, MapPin, CheckCircle2, Loader2, AlertCircle,
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
  const [isOnline, setIsOnline]   = useState(true);
  const [pending, setPending]     = useState(0);
  const [gpsWarn, setGpsWarn]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [lastSync, setLastSync]   = useState<string | null>(null);

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
      setGpsWarn("Location unavailable — punch recorded without GPS coordinates.");
    }

    const id        = attendanceCuid();
    const timestamp = new Date().toISOString();

    await enqueuePunch({ id, type, timestamp, lat, lng });

    // Optimistic update — show the time immediately, sync in background
    setLocal((prev) => ({
      ...prev,
      inAt:  type === "in"  ? timestamp : prev.inAt,
      outAt: type === "out" ? timestamp : prev.outAt,
    }));

    // Trigger drain (drain loop picks it up via the listener; nudge count)
    countPendingPunches().then(setPending);
    setLoading(false);
  }, []);

  const hasPunchIn  = !!local.inAt;
  const hasPunchOut = !!local.outAt;
  const nextType: PunchType = hasPunchIn ? "out" : "in";

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* ── Status bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 text-[12px] text-text-muted">
          {isOnline ? (
            <>
              <Wifi size={13} className="text-solid" />
              Online
            </>
          ) : (
            <>
              <WifiOff size={13} className="text-fault" />
              Offline
            </>
          )}
          {pending > 0 && (
            <span className="ml-2 rounded-full bg-heat/20 text-heat px-2 py-0.5 text-[11px] font-medium tabular-nums">
              {pending} pending
            </span>
          )}
        </div>
        {lastSync && (
          <span className="text-[11px] text-text-subtle tabular-nums">
            Synced {lastSync}
          </span>
        )}
      </div>

      {/* ── Main ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-7">

        {/* Employee + date */}
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
            {todayLabel()}
          </p>
          <h1 className="mt-1 font-display text-[28px] font-semibold tracking-[-0.015em] text-text leading-snug">
            {employee.name}
          </h1>
        </div>

        {/* Punch times card */}
        {(hasPunchIn || hasPunchOut) && (
          <div className="w-full max-w-xs divide-y divide-border/40 rounded-[12px] border border-border bg-surface text-[13px]">
            {hasPunchIn && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-2 text-text-muted">
                  <Clock size={14} strokeWidth={1.8} />
                  Punch in
                </span>
                <span className="font-data tabular-nums text-text">
                  {fmtTime(local.inAt!)}
                </span>
              </div>
            )}
            {hasPunchOut && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-2 text-text-muted">
                  <Clock size={14} strokeWidth={1.8} />
                  Punch out
                </span>
                <span className="font-data tabular-nums text-text">
                  {fmtTime(local.outAt!)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* GPS warning */}
        {gpsWarn && (
          <p className="flex items-start gap-1.5 text-[12px] text-heat max-w-xs text-center leading-snug">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            {gpsWarn}
          </p>
        )}

        {/* Action */}
        {local.locked ? (
          <div className="flex items-center gap-2 text-[13px] text-text-muted">
            <CheckCircle2 size={16} className="text-text-subtle" />
            Attendance is locked for today.
          </div>
        ) : hasPunchIn && hasPunchOut ? (
          <div className="flex items-center gap-2 text-solid text-[15px] font-medium">
            <CheckCircle2 size={18} strokeWidth={1.8} />
            All done — see you tomorrow!
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => handlePunch(nextType)}
            className={[
              "w-full max-w-xs min-h-16 rounded-[14px] text-[16px] font-semibold",
              "flex items-center justify-center gap-3 transition-all active:scale-[0.98]",
              nextType === "in"
                ? "bg-gold text-ink hover:bg-gold-strong"
                : "bg-heat/15 border border-heat/30 text-heat hover:bg-heat/25",
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

        {/* Offline queue note */}
        {pending > 0 && !isOnline && (
          <p className="text-[12px] text-text-subtle text-center max-w-xs leading-snug">
            {pending} punch{pending !== 1 ? "es" : ""} queued locally — will sync automatically when back online.
          </p>
        )}
      </div>
    </div>
  );
}
