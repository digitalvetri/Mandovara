"use client";

// Check in and check out, from wherever you are.
//
// Owner instruction 2026-08-27: staff get a dashboard where they check
// in and out. Inside the location the admin configured, the punch is
// recorded straight away. Outside it, they are asked where they are, and
// the punch is recorded with that answer.
//
// The old behaviour refused an off-site punch. For a furnishing business
// that is backwards — a measurement executive spends the day at client
// villas, and blocking their check-in does not stop them working, it
// only means the day is never recorded and payroll under-counts them.
//
// This is the single punch control used on the dashboard, the employee
// home and the attendance page, so the three cannot drift.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, MapPin, Loader2, Check } from "lucide-react";
import { selfCheckIn, selfCheckOut, type CheckResult } from "@/app/(app)/attendance/_actions";

type Mode = "in" | "out";

interface Props {
  /** ISO string of today's check-in, if it has happened. */
  inAt:      string | null;
  outAt:     string | null;
  isLocked?: boolean;
  /** Chrome variant: the dark dashboard band vs a normal white card. */
  onChrome?: boolean;
}

function getGps(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      // A refusal or a timeout is not a failure any more — the server
      // treats "no fix" as off-site and asks where they are.
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

export function PunchCard({ inAt, outAt, isLocked = false, onChrome = false }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking]   = useState<{ mode: Mode; distanceM: number; branchName: string } | null>(null);
  const [place, setPlace]     = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const done = inAt !== null && outAt !== null;

  function run(mode: Mode, withPlace?: string): void {
    setMessage(null);
    start(async () => {
      const geo = await getGps();
      const res: CheckResult = mode === "in"
        ? await selfCheckIn(geo, withPlace)
        : await selfCheckOut(geo, withPlace);

      if (res.needsPlace) {
        setAsking({
          mode,
          distanceM:  res.distanceM ?? 0,
          branchName: res.branchName ?? "the office",
        });
        return;
      }
      if (!res.ok) {
        setMessage({ tone: "err", text: res.error ?? "Could not record that." });
        return;
      }
      setAsking(null);
      setPlace("");
      setMessage({
        tone: "ok",
        text: mode === "in"
          ? `Checked in at ${res.time}`
          : `Checked out at ${res.time}${res.worked ? ` · ${res.worked}` : ""}`,
      });
      router.refresh();
    });
  }

  const label = onChrome
    ? { muted: "text-sidebar-text/70", strong: "text-sidebar-text" }
    : { muted: "text-text-dim",        strong: "text-text" };

  // ── "Where are you?" ────────────────────────────────────────────────
  if (asking) {
    return (
      <div className="space-y-2">
        <div className={`text-[12px] ${label.strong}`}>
          {asking.distanceM > 0
            ? `You're ${asking.distanceM}m from ${asking.branchName}.`
            : `We couldn't confirm you're at ${asking.branchName}.`}
          {" "}Where are you working from?
        </div>
        <div className="flex gap-2">
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            autoFocus
            maxLength={120}
            placeholder="e.g. Dr Kannan site, Saibaba Colony"
            className={
              "h-9 min-w-0 flex-1 rounded-[8px] border px-3 text-[12.5px] focus:outline-none " +
              (onChrome
                ? "border-sidebar-text/25 bg-transparent text-sidebar-text placeholder:text-sidebar-text/40 focus:border-accent-chrome"
                : "border-rule bg-transparent text-text placeholder:text-text-faint focus:border-accent")
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && place.trim().length >= 3) run(asking.mode, place.trim());
            }}
          />
          <button
            type="button"
            disabled={pending || place.trim().length < 3}
            onClick={() => run(asking.mode, place.trim())}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] bg-accent px-3.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
            Record
          </button>
        </div>
        <button
          type="button"
          onClick={() => { setAsking(null); setPlace(""); }}
          className={`text-[11.5px] ${label.muted} hover:underline`}
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Normal state ───────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!inAt && (
          <button
            type="button"
            disabled={pending || isLocked}
            onClick={() => run("in")}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-accent px-4 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
            Check in
          </button>
        )}

        {inAt && !outAt && (
          <button
            type="button"
            disabled={pending || isLocked}
            onClick={() => run("out")}
            className={
              "inline-flex h-9 items-center gap-2 rounded-[8px] border px-4 text-[12.5px] font-medium transition-colors disabled:opacity-50 " +
              (onChrome
                ? "border-sidebar-text/30 text-sidebar-text hover:border-accent-chrome"
                : "border-rule text-text hover:border-accent")
            }
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
            Check out
          </button>
        )}

        {inAt && (
          <span className={`tabular text-[12px] ${label.muted}`}>
            In {fmt(inAt)}
            {outAt && ` · Out ${fmt(outAt)}`}
          </span>
        )}

        {done && <Check size={14} className="text-solid-chrome" aria-label="Day complete" />}
      </div>

      {isLocked && (
        <div className={`text-[11.5px] ${label.muted}`}>
          This month is locked for payroll — attendance can no longer be changed.
        </div>
      )}

      {message && (
        <div className={`text-[11.5px] ${message.tone === "ok" ? "text-solid-chrome" : "text-fault-chrome"}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
