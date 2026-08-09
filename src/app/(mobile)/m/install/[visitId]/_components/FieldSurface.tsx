"use client";

// The client-side install-visit surface driven from IndexedDB outbox.
// Server-fetched initial state comes in via props; every user
// mutation writes to the outbox (which optimistically dispatches
// when online). On refresh the server-rendered state is authoritative
// again — this is a degradation surface, not full offline.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { enqueue, installSyncLoop, peekOutbox, drain } from "@/lib/outbox";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

// Trimmed shape passed from the server component. Matches the
// InstallVisitDetail from modules/install/queries but with only the
// fields the field surface needs.
interface Line {
  id:               string;
  roomLabel:        string;
  productName:      string;
  productUom:       string;
  plannedQty:       string;
  installedQty:     string;    // server-side; not adjusted for pending outbox
  dyeLotUsed:       string | null;
}
interface Props {
  visit: {
    id:            string;
    number:        string;
    status:        string;
    clientName:    string;
    clientMobile:  string;
    orderNumber:   string;
    hasSignature:  boolean;
  };
  lines: Line[];
}

interface PendingDelta {
  lineId:       string;
  deltaQty:     number;
  dyeLotUsed?:  string;
}

export function FieldSurface({ visit, lines }: Props) {
  const router = useRouter();
  const [, startT] = useTransition();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [localCompleted, setLocalCompleted] = useState<Record<string, PendingDelta>>({});
  const [signed, setSigned] = useState(false);
  const [draining, setDraining] = useState(false);
  const padRef = useRef<SignaturePadHandle | null>(null);

  // Boot the sync loop once. Also refresh the pending count on any
  // outbox activity so the "queued" chip stays honest.
  useEffect(() => {
    installSyncLoop();
    const bump = async () => setPendingCount((await peekOutbox()).length);
    void bump();
    const onOnline  = () => { setOnline(true);  void bump(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    setOnline(navigator.onLine);
    // Poll every 1.5s for pending — cheap, and any drain elsewhere
    // (visibility change etc.) is reflected without an event bus.
    const iv = window.setInterval(bump, 1500);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(iv);
    };
  }, []);

  const linesById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  async function onLogLine(lineId: string) {
    setLastError(null);
    const line = linesById.get(lineId);
    if (!line) return;
    const plannedNum = Number(line.plannedQty);
    const already = Number(localCompleted[lineId]?.deltaQty ?? 0);
    if (already >= plannedNum) {
      setLastError(`Already fully installed on this visit (${plannedNum}).`);
      return;
    }
    // One tap = +1. For >1 planned qty an installer taps once per unit.
    // Complex multi-unit sites can do full quantity via the office view.
    const dye = window.prompt("Dye lot used (optional):", line.dyeLotUsed ?? "");
    // window.prompt returns null on Escape; treat that as cancellation.
    if (dye === null) return;
    const nextDelta = already + 1;
    setLocalCompleted((s) => ({
      ...s, [lineId]: { lineId, deltaQty: nextDelta, dyeLotUsed: dye.trim() || undefined },
    }));
    startT(async () => {
      await enqueue("completeInstallLine", {
        lineId,
        installedQty: 1,   // delta per tap
        ...(dye.trim().length > 0 && { dyeLotUsed: dye.trim() }),
      });
      setPendingCount((await peekOutbox()).length);
    });
  }

  async function onCompleteVisit(outcome: "COMPLETED" | "PARTIAL") {
    setLastError(null);
    if (padRef.current?.isEmpty()) {
      setLastError("Capture the client's signature first.");
      return;
    }
    const sigKey = padRef.current!.toDataURL();
    setSigned(true);
    startT(async () => {
      await enqueue("signAndCompleteVisit", {
        visitId: visit.id,
        signatureKey: sigKey,
        outcome,
      });
      setPendingCount((await peekOutbox()).length);
      if (navigator.onLine) {
        // Nudge the router so the office view refreshes.
        setTimeout(() => router.refresh(), 500);
      }
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

  const alreadyCompleted = visit.status === "COMPLETED" || visit.status === "PARTIAL";

  return (
    <div className="min-h-svh flex flex-col">
      {/* ── Top bar (sticky) ────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-surface border-b border-rule px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="tabular text-[13.5px] font-medium text-text truncate">
              {visit.number}
            </div>
            <div className="text-[11px] text-text-dim truncate">
              {visit.clientName} · {visit.orderNumber}
            </div>
          </div>
          <NetworkChip online={online} pending={pendingCount} draining={draining} />
        </div>
        {alreadyCompleted && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-good">
            <CheckCircle size={12} /> Visit {visit.status.toLowerCase()} — no further edits
          </div>
        )}
      </header>

      {/* ── Line list ───────────────────────────────────────── */}
      <main className="flex-1 px-4 py-4 space-y-3">
        {lines.length === 0 && (
          <div className="text-center text-[13px] text-text-faint py-10">
            No lines on this visit.
          </div>
        )}
        {lines.map((l) => {
          const localDelta = localCompleted[l.id]?.deltaQty ?? 0;
          const shownInstalled = Number(l.installedQty) + localDelta;
          const planned = Number(l.plannedQty);
          const done = shownInstalled >= planned;
          return (
            <LineCard key={l.id}
              line={l} shownInstalled={shownInstalled} planned={planned} done={done}
              onLog={() => onLogLine(l.id)}
              disabled={alreadyCompleted}
              queuedDye={localCompleted[l.id]?.dyeLotUsed}
            />
          );
        })}

        {/* ── Signature + complete ───────────────────────── */}
        {!alreadyCompleted && (
          <section className="mt-6 rounded-[12px] bg-surface border border-rule p-4 space-y-3">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              Client signature
            </div>
            <SignaturePad ref={padRef} height={180} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => padRef.current?.clear()}
                className="h-[40px] px-3 rounded-[8px] text-[12.5px] font-medium bg-surface border border-rule text-text-dim hover:text-text"
              >
                Clear
              </button>
              <div className="flex-1" />
              <button
                type="button"
                data-testid="mark-partial"
                onClick={() => onCompleteVisit("PARTIAL")}
                className="h-[44px] px-4 rounded-[8px] text-[13px] font-medium bg-surface border border-rule text-text-dim"
              >
                Partial
              </button>
              <button
                type="button"
                data-testid="complete-visit"
                onClick={() => onCompleteVisit("COMPLETED")}
                className="h-[44px] px-5 rounded-[8px] text-[13px] font-semibold bg-good text-white"
              >
                Complete
              </button>
            </div>
            {signed && (
              <div className="text-[11px] text-good">
                Queued — will sync on next network signal.
              </div>
            )}
            {lastError && (
              <div className="text-[11.5px] text-bad">{lastError}</div>
            )}
          </section>
        )}
      </main>

      {/* ── Force-drain FAB (visible when items pending) ─── */}
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

function LineCard({
  line, shownInstalled, planned, done, disabled, queuedDye, onLog,
}: {
  line: Line; shownInstalled: number; planned: number; done: boolean;
  disabled: boolean; queuedDye?: string; onLog: () => void;
}) {
  return (
    <div className={`rounded-[12px] bg-surface border p-4 ${done ? "border-good/40" : "border-rule"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] text-text truncate">{line.roomLabel}</div>
          <div className="text-[11.5px] text-text-dim truncate">
            {line.productName} · per {line.productUom.toLowerCase()}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="tabular text-[13.5px] text-text">
            <span className={done ? "text-good" : ""}>{shownInstalled}</span>
            <span className="text-text-faint"> / {planned}</span>
          </div>
          {(queuedDye ?? line.dyeLotUsed) && (
            <div className="text-[10.5px] tabular text-text-dim mt-0.5">
              lot {queuedDye ?? line.dyeLotUsed}
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        data-testid={`log-line-${line.id}`}
        onClick={onLog}
        disabled={disabled || done}
        className={`mt-3 w-full h-[48px] rounded-[10px] text-[14px] font-medium transition-colors disabled:opacity-40 ${done ? "bg-good/10 text-good" : "bg-accent text-white"}`}
      >
        {done ? "Fully installed" : "Log +1 install"}
      </button>
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

