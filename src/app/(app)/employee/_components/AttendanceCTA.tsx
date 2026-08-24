"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2, MapPin, MapPinOff, CheckCircle2, AlertCircle } from "lucide-react";
import { selfCheckIn, selfCheckOut } from "../../attendance/_actions";

export interface AttendanceCTAProps {
  initialInAt:    string | null;  // ISO string from DB
  initialOutAt:   string | null;
  initialStatus:  string | null;
  isLocked:       boolean;
}

type GpsState = "idle" | "requesting" | "ok" | "denied";
type Banner   = { variant: "success" | "error"; message: string } | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtISO(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function elapsedStr(fromISO: string, toISO?: string | null): string {
  const mins = Math.max(0, Math.floor(
    ((toISO ? new Date(toISO) : new Date()).getTime() - new Date(fromISO).getTime()) / 60000,
  ));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function getGps(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000, enableHighAccuracy: true },
    );
  });
}

const STATUS_COLOR: Record<string, string> = {
  PRESENT:  "text-solid-chrome",
  HALF_DAY: "text-heat-chrome",
  ABSENT:   "text-fault-chrome",
  LEAVE:    "text-info-chrome",
  HOLIDAY:  "text-gold-chrome",
  WEEK_OFF: "text-sidebar-dim",
};
const STATUS_LABEL: Record<string, string> = {
  PRESENT:  "Present",
  HALF_DAY: "Half Day",
  ABSENT:   "Absent",
  LEAVE:    "On Leave",
  HOLIDAY:  "Holiday",
  WEEK_OFF: "Week Off",
};

const NON_WORK = new Set(["LEAVE", "HOLIDAY", "WEEK_OFF"]);

// ── Component ─────────────────────────────────────────────────────────────────

export function AttendanceCTA({
  initialInAt,
  initialOutAt,
  initialStatus,
  isLocked,
}: AttendanceCTAProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [inAt,        setInAt]        = useState<string | null>(initialInAt);
  const [outAt,       setOutAt]       = useState<string | null>(initialOutAt);
  const [status,      setStatus]      = useState<string | null>(initialStatus);
  const [gps,         setGps]         = useState<GpsState>("idle");
  const [locRecorded, setLocRecorded] = useState(false);
  const [elapsed,     setElapsed]     = useState<string | null>(
    initialInAt && !initialOutAt ? elapsedStr(initialInAt) : null,
  );
  const [banner, setBanner] = useState<Banner>(null);

  // Live working timer — ticks every 30 s while checked in, stops after checkout
  useEffect(() => {
    if (!inAt || outAt) return;
    const id = setInterval(() => setElapsed(elapsedStr(inAt)), 30_000);
    return () => clearInterval(id);
  }, [inAt, outAt]);

  const isNonWorkDay = NON_WORK.has(status ?? "");
  const isCheckedIn  = !!inAt && !outAt && !isNonWorkDay;
  const isComplete   = !!inAt && !!outAt;
  const notStarted   = !inAt && !isNonWorkDay;
  const isBusy       = pending || gps === "requesting";

  // ── GPS + check-in ────────────────────────────────────────────────────────

  async function handleCheckIn() {
    if (isBusy || isLocked) return;
    setBanner(null);
    setGps("requesting");

    let geo: { lat: number; lng: number } | undefined;
    try {
      geo = await getGps();
      setGps("ok");
    } catch {
      setGps("denied");
      setBanner({
        variant: "error",
        message: "Location access is required to check in. Please allow location access and try again.",
      });
      return;
    }

    startTransition(async () => {
      const res = await selfCheckIn(geo);
      if (res.ok && res.time) {
        const now = new Date().toISOString();
        setInAt(now);
        setStatus("PRESENT");
        setElapsed(elapsedStr(now));
        setLocRecorded(true);
        setGps("idle");
        setBanner({ variant: "success", message: `Checked in at ${res.time} · Location recorded` });
        router.refresh();
      } else {
        setGps("idle");
        setBanner({ variant: "error", message: res.error ?? "Could not record check-in." });
      }
    });
  }

  // ── GPS + check-out ───────────────────────────────────────────────────────

  async function handleCheckOut() {
    if (isBusy || isLocked || !inAt) return;
    setBanner(null);
    setGps("requesting");

    let geo: { lat: number; lng: number } | undefined;
    try {
      geo = await getGps();
      setGps("ok");
    } catch {
      setGps("denied");
      setBanner({
        variant: "error",
        message: "Location access is required to check out. Please allow location access and try again.",
      });
      return;
    }

    startTransition(async () => {
      const res = await selfCheckOut(geo);
      if (res.ok && res.time) {
        const now  = new Date().toISOString();
        const worked = res.worked ?? elapsedStr(inAt!, now);
        setOutAt(now);
        setElapsed(worked);
        setGps("idle");
        setBanner({
          variant: "success",
          message: `Checked out at ${res.time} · ${worked} worked · Location recorded`,
        });
        router.refresh();
      } else {
        setGps("idle");
        setBanner({ variant: "error", message: res.error ?? "Could not record check-out." });
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-5 space-y-3">

      {/* Banner */}
      {banner && (
        <div className={[
          "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12px] leading-snug",
          banner.variant === "success"
            ? "border-solid-chrome/20 bg-solid-chrome/10 text-solid-chrome"
            : "border-fault-chrome/25 bg-fault-chrome/10 text-fault-chrome",
        ].join(" ")}>
          {banner.variant === "success"
            ? <CheckCircle2 size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
            : <AlertCircle  size={13} strokeWidth={2} className="mt-0.5 shrink-0" />}
          <span className="font-medium">{banner.message}</span>
        </div>
      )}

      {/* Status + time info */}
      {isNonWorkDay ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-[13px] font-semibold ${STATUS_COLOR[status ?? ""] ?? "text-sidebar-dim"}`}>
            {STATUS_LABEL[status ?? ""] ?? status}
          </span>
        </div>
      ) : isComplete ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-solid-chrome">Day Complete</span>
          <span className="font-data tabular-nums text-[12px] text-sidebar-dim">
            In {fmtISO(inAt!)}
          </span>
          <span className="font-data tabular-nums text-[12px] text-sidebar-dim">
            · Out {fmtISO(outAt!)}
          </span>
          {elapsed && (
            <span className="font-data tabular-nums text-[12px] text-sidebar-dim">
              · {elapsed}
            </span>
          )}
        </div>
      ) : isCheckedIn ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* Pulsing "Checked In" badge */}
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-solid-chrome">
            <span className="inline-block h-2 w-2 rounded-full bg-solid-chrome animate-pulse" />
            Checked In
          </span>
          <span className="font-data tabular-nums text-[12px] text-sidebar-dim">
            {fmtISO(inAt!)}
          </span>
          {elapsed && (
            <span className="font-data tabular-nums text-[12px] text-sidebar-dim">
              · {elapsed}
            </span>
          )}
          {locRecorded && (
            <span className="inline-flex items-center gap-1 text-[11px] text-sidebar-dim">
              <MapPin size={11} strokeWidth={2} />
              Location recorded
            </span>
          )}
        </div>
      ) : (
        <span className="text-[12.5px] text-sidebar-dim">Not yet checked in.</span>
      )}

      {/* Action button — hidden for non-work days, locked days, and completed days */}
      {!isNonWorkDay && !isComplete && !isLocked && (
        <div className="flex flex-wrap items-center gap-3">
          {isCheckedIn ? (
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-heat-chrome/30 bg-heat-chrome/10 px-3.5 py-1.5 text-[12px] font-semibold text-heat-chrome transition-colors hover:bg-heat-chrome/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  {gps === "requesting" ? "Getting location…" : "Checking out…"}
                </>
              ) : (
                <>
                  <LogOut size={13} strokeWidth={2} />
                  Check Out
                </>
              )}
            </button>
          ) : notStarted ? (
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent-chrome/30 bg-accent-chrome/15 px-4 py-1.5 text-[12px] font-semibold text-accent-chrome transition-colors hover:bg-accent-chrome/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  {gps === "requesting" ? "Getting location…" : "Checking in…"}
                </>
              ) : (
                <>
                  <LogIn size={13} strokeWidth={2} />
                  Check In
                </>
              )}
            </button>
          ) : null}

          {/* Location denied indicator alongside the button */}
          {gps === "denied" && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-fault-chrome">
              <MapPinOff size={12} strokeWidth={2} />
              Location denied
            </span>
          )}
        </div>
      )}

      {isLocked && (
        <p className="text-[12px] text-sidebar-dim">🔒 Attendance locked — contact HR</p>
      )}
    </div>
  );
}
