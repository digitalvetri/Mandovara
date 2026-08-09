"use client";

// Mobile attendance surface — pick an employee, tap a status, punch
// captured to the outbox with optional GPS location. When online,
// the drain fires immediately; when offline, records queue until
// signal returns. Reuses the outbox module from Phase 5c-PWA.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, Wifi, WifiOff, RefreshCw, CheckCircle,
} from "lucide-react";
import { enqueue, installSyncLoop, peekOutbox, drain } from "@/lib/outbox";

interface Employee {
  id: string; code: string; name: string; department: string | null;
}
interface Props {
  employees: Employee[];
}

type PunchStatus = "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "LEAVE";

const STATUSES: { s: PunchStatus; label: string; tone: string }[] = [
  { s: "PRESENT",  label: "Present",  tone: "bg-good text-white"                     },
  { s: "LATE",     label: "Late",     tone: "bg-heat text-white"                     },
  { s: "HALF_DAY", label: "Half day", tone: "bg-heat/60 text-white"                  },
  { s: "LEAVE",    label: "Leave",    tone: "bg-info text-white"                     },
  { s: "ABSENT",   label: "Absent",   tone: "bg-bad text-white"                      },
];

interface LatestPunch {
  employeeCode: string; name: string; status: string; at: number;
  location: { lat: number; lng: number } | null;
}

export function AttendanceSurface({ employees }: Props) {
  const router = useRouter();
  const [, startT] = useTransition();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [draining, setDraining] = useState(false);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<LatestPunch | null>(null);
  // Cache the most recently fetched location so consecutive punches
  // don't re-prompt for GPS permission every time.
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    installSyncLoop();
    const bump = async () => setPendingCount((await peekOutbox()).length);
    void bump();
    const onOnline  = () => { setOnline(true);  void bump(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    setOnline(navigator.onLine);
    const iv = window.setInterval(bump, 1500);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(iv);
    };
  }, []);

  function tryGeolocate(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve(null); return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLastLocation(loc);
          setGpsError(null);
          resolve(loc);
        },
        (err) => {
          setGpsError(`GPS unavailable: ${err.message}`);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      );
    });
  }

  async function punch(status: PunchStatus) {
    setError(null);
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) { setError("Pick an employee first."); return; }

    const loc = lastLocation ?? await tryGeolocate();
    const now = new Date();
    const dateISO = now.toISOString().slice(0, 10);
    const timeISO = now.toTimeString().slice(0, 5);   // HH:MM

    startT(async () => {
      await enqueue("markPunch", {
        employeeId: emp.id,
        date: dateISO,
        status,
        inTime: timeISO,
        ...(loc && { location: loc }),
      });
      setPendingCount((await peekOutbox()).length);
      setLatest({
        employeeCode: emp.code, name: emp.name, status,
        at: now.getTime(), location: loc,
      });
    });
  }

  async function onForceDrain() {
    setDraining(true);
    try {
      await drain();
      setPendingCount((await peekOutbox()).length);
      router.refresh();
    } finally {
      setDraining(false);
    }
  }

  const emp = employees.find((e) => e.id === employeeId);

  return (
    <div className="min-h-svh flex flex-col">
      {/* ── Top bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-surface border-b border-rule px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-text truncate">
              Mark attendance
            </div>
            <div className="text-[10.5px] text-text-dim">
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              {lastLocation && (
                <>
                  {" · "}<MapPin size={9} className="inline mb-0.5" /> {lastLocation.lat.toFixed(3)}, {lastLocation.lng.toFixed(3)}
                </>
              )}
            </div>
          </div>
          <NetworkChip online={online} pending={pendingCount} draining={draining} />
        </div>
      </header>

      {/* ── Employee picker ────────────────────────────────── */}
      <div className="px-4 pt-4">
        <label className="block">
          <div className="text-[10px] uppercase tracking-[0.14em] text-text-dim mb-1.5">Employee</div>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full h-[46px] px-3 bg-surface border border-rule rounded-[10px] text-[14px]"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.code}{e.department ? ` · ${e.department}` : ""}
              </option>
            ))}
          </select>
        </label>
        {emp && (
          <div className="mt-1 text-[11px] text-text-dim">
            {emp.department ?? "—"}
          </div>
        )}
      </div>

      {/* ── Status buttons (big touch targets) ────────────── */}
      <main className="flex-1 px-4 py-4 space-y-2.5">
        {STATUSES.map((s) => (
          <button
            key={s.s}
            type="button"
            data-testid={`punch-${s.s}`}
            onClick={() => punch(s.s)}
            disabled={!emp}
            className={`w-full h-[56px] rounded-[12px] text-[15px] font-semibold transition-opacity disabled:opacity-40 ${s.tone}`}
          >
            {s.label}
          </button>
        ))}

        {gpsError && (
          <div className="text-[11px] text-text-faint mt-2">{gpsError} — punch will still queue.</div>
        )}
        {error && (
          <div className="text-[11.5px] text-bad">{error}</div>
        )}

        {latest && (
          <div className="mt-4 rounded-[12px] bg-good/10 border border-good/30 p-4">
            <div className="flex items-center gap-2 text-good font-medium">
              <CheckCircle size={14} /> Punched — {latest.name}
            </div>
            <div className="text-[11.5px] text-text-dim mt-1">
              {latest.status.toLowerCase()} at{" "}
              {new Date(latest.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              {latest.location && (
                <> · GPS captured</>
              )}
            </div>
            <div className="text-[10.5px] text-text-faint mt-1">
              {online ? "Sending…" : "Queued — will sync when online."}
            </div>
          </div>
        )}
      </main>

      {/* ── Force-drain FAB ───────────────────────────────── */}
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={onForceDrain}
          disabled={draining}
          className="fixed bottom-4 right-4 h-[46px] px-4 rounded-full bg-accent text-white text-[12px] font-medium shadow-lg flex items-center gap-2 disabled:opacity-60"
          aria-label="Force sync"
        >
          <RefreshCw size={13} className={draining ? "animate-spin" : ""} />
          Sync {pendingCount}
        </button>
      )}
    </div>
  );
}

function NetworkChip({
  online, pending, draining,
}: { online: boolean; pending: number; draining: boolean }) {
  const Icon = online ? Wifi : WifiOff;
  const tone = online
    ? (pending > 0 ? "bg-heat/[0.12] text-heat" : "bg-good/[0.12] text-good")
    : "bg-bad/[0.12] text-bad";
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[10.5px] uppercase tracking-[0.06em] tabular ${tone}`}>
      <Icon size={11} />
      {online ? "online" : "offline"}
      {pending > 0 && <span>· queued {pending}</span>}
      {draining && <span>· syncing</span>}
    </div>
  );
}
