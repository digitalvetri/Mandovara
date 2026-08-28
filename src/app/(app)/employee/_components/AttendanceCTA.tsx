"use client";

import { diagnoseGeoError, readPosition, type GeoDiagnosis } from "@/lib/geolocation";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2, MapPin, MapPinOff, AlertCircle, RefreshCw } from "lucide-react";
import { selfCheckIn, selfCheckOut } from "../../attendance/_actions";
import {
  type GpsState, type Banner,
  STATUS_COLOR, STATUS_LABEL, NON_WORK,
  fmtISO, elapsedStr,
} from "./attendance-cta-helpers";

export interface AttendanceCTAProps {
  initialInAt:    string | null;  // ISO string from DB
  initialOutAt:   string | null;
  initialStatus:  string | null;
  isLocked:       boolean;
  fenceBranchName?: string | null;
  fenceRadiusM?:    number | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AttendanceCTA({
  initialInAt,
  initialOutAt,
  initialStatus,
  isLocked,
  fenceBranchName,
  fenceRadiusM,
}: AttendanceCTAProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [inAt,        setInAt]        = useState<string | null>(initialInAt);
  const [outAt,       setOutAt]       = useState<string | null>(initialOutAt);
  const [status,      setStatus]      = useState<string | null>(initialStatus);
  const [gps,         setGps]         = useState<GpsState>("idle");
  const [locRecorded, setLocRecorded] = useState(false);
  const [elapsed,     setElapsed]     = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  // The last location failure, kept so the banner can say WHY and offer
  // the right next step rather than one generic sentence.
  const [geoProblem, setGeoProblem] = useState<GeoDiagnosis | null>(null);

  // Live working timer — ticks every 30 s while checked in, stops after checkout.
  // Initialised in useEffect (not useState) to avoid SSR/client hydration mismatch.
  useEffect(() => {
    if (!inAt || outAt) { setElapsed(null); return; }
    setElapsed(elapsedStr(inAt));
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
      geo = await readPosition();
      setGps("ok");
      setGeoProblem(null);
    } catch (err) {
      const d = diagnoseGeoError(err);
      setGps("denied");
      setGeoProblem(d);
      setBanner({ variant: "error", message: d.title });
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
        setGeoProblem(null);
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
      geo = await readPosition();
      setGps("ok");
      setGeoProblem(null);
    } catch (err) {
      const d = diagnoseGeoError(err);
      setGps("denied");
      setGeoProblem(d);
      setBanner({ variant: "error", message: d.title });
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

  const hasFence = !!fenceBranchName && !!fenceRadiusM;

  return (
    <div className="mt-5 space-y-3">

      {/* Geofence chip — shows what location the server will enforce */}
      {hasFence && !isComplete && !isNonWorkDay && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-chrome/25 bg-accent-chrome/10 px-3 py-1 text-[11px] text-sidebar-text">
          <MapPin size={11} strokeWidth={2} className="text-accent-chrome" />
          Attendance fence: <span className="font-medium">{fenceBranchName}</span> · {fenceRadiusM}m
        </div>
      )}

      {/* Banner — errors only; success is conveyed by the status row.
          A location failure carries the reason and, when retrying can
          actually help, a Retry button so nobody reloads the page. An
          insecure origin gets no button: it would fail identically every
          time, and offering one implies the employee can fix it. */}
      {banner?.variant === "error" && (
        <div className="rounded-xl border border-fault-chrome/25 bg-fault-chrome/10 px-3.5 py-2.5 text-[12px] leading-snug text-fault-chrome" role="alert">
          <div className="flex items-start gap-2">
            <AlertCircle size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{banner.message}</div>
              {geoProblem?.advice && (
                <div className="mt-1 text-sidebar-dim">{geoProblem.advice}</div>
              )}
              {(geoProblem === null || geoProblem.retryable) && (
                <button
                  type="button"
                  onClick={() => { setBanner(null); setGeoProblem(null); void (inAt ? handleCheckOut() : handleCheckIn()); }}
                  disabled={isBusy}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-fault-chrome/40 px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-fault-chrome/15 disabled:opacity-50"
                >
                  <RefreshCw size={11} strokeWidth={2} />
                  {geoProblem ? "Retry location" : (inAt ? "Retry check-out" : "Retry check-in")}
                </button>
              )}
            </div>
          </div>
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

          {/* Location indicator alongside the button. "Location denied"
              was wrong on the deployment that prompted this: over plain
              http:// the browser never asked, so nothing was denied. The
              badge now names what actually happened. */}
          {gps === "denied" && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-fault-chrome">
              <MapPinOff size={12} strokeWidth={2} />
              {geoProblem?.kind === "insecure-context" ? "Location blocked (not HTTPS)"
                : geoProblem?.kind === "timeout"       ? "Location timed out"
                : geoProblem?.kind === "unavailable"   ? "No location fix"
                : geoProblem?.kind === "unsupported"   ? "Location unsupported"
                : "Location denied"}
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
