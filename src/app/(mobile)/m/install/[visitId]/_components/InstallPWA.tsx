"use client";

import { useState, useRef, useTransition } from "react";
import { recordInstallLine, completeInstallVisit, startInstallVisit } from "@/modules/install/actions";
import { CheckCircle2, Circle, PenLine, Loader2 } from "lucide-react";

type Line = {
  id: string;
  roomLabel: string;
  plannedQty: { toString(): string };
  installedQty: { toString(): string };
  dyeLotUsed: string | null;
  issue: string | null;
  orderLine: { description: string } | null;
};

type Visit = {
  id: string;
  number: string;
  status: string;
  scheduledAt: Date;
  completedAt: Date | null;
  clientSignatureKey: string | null;
  notes: string | null;
  project: {
    name: string;
    siteAddress: unknown;
    client: { name: string; mobile: string };
  };
  lines: Line[];
};

interface LineState {
  installedQty: string;
  dyeLotUsed: string;
  issue: string;
  saved: boolean;
}

export function InstallPWA({ visit }: { visit: Visit }) {
  const [lineStates, setLineStates] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      visit.lines.map((l) => [
        l.id,
        {
          installedQty: l.installedQty.toString(),
          dyeLotUsed: l.dyeLotUsed ?? "",
          issue: l.issue ?? "",
          saved: parseFloat(l.installedQty.toString()) > 0,
        },
      ]),
    ),
  );
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [sigMode, setSigMode] = useState(false);
  const [sigDrawn, setSigDrawn] = useState(!!visit.clientSignatureKey);
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(visit.status === "COMPLETED");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const isCompleted = visit.status === "COMPLETED" || done;
  const completedCount = Object.values(lineStates).filter((s) => s.saved).length;

  function saveLine(lineId: string) {
    const state = lineStates[lineId];
    if (!state) return;
    startTransition(async () => {
      const result = await recordInstallLine({
        installLineId: lineId,
        installedQty: parseFloat(state.installedQty) || 0,
        dyeLotUsed: state.dyeLotUsed || undefined,
        issue: state.issue || undefined,
      });
      if (result.ok) {
        setLineStates((prev) => ({
          ...prev,
          [lineId]: { ...state, saved: true },
        }));
        setActiveLineId(null);
        setStatusMsg("Saved");
        setTimeout(() => setStatusMsg(null), 2000);
      } else {
        setStatusMsg(result.error ?? "Save failed");
      }
    });
  }

  // Signature canvas helpers
  function getPos(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      if (!t) return null;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#141B22";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setSigDrawn(true);
  }

  function endDraw() {
    isDrawing.current = false;
  }

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigDrawn(false);
  }

  function handleComplete() {
    if (!visit.status.includes("PROGRESS") && visit.status !== "SCHEDULED") return;
    setCompleting(true);
    const signatureKey = sigDrawn && canvasRef.current
      ? canvasRef.current.toDataURL("image/png")
      : undefined;

    startTransition(async () => {
      if (visit.status === "SCHEDULED") {
        await startInstallVisit({ visitId: visit.id });
      }
      const result = await completeInstallVisit({
        visitId: visit.id,
        clientSignatureKey: signatureKey,
      });
      if (result.ok) {
        setDone(true);
        setSigMode(false);
      } else {
        setStatusMsg(result.error ?? "Complete failed");
      }
      setCompleting(false);
    });
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 size={56} className="text-green-600 mb-4" strokeWidth={1.5} />
        <h1 className="text-[22px] font-semibold text-gray-900 mb-2">Visit Complete</h1>
        <p className="text-[14px] text-gray-600">{visit.project.name}</p>
        <p className="text-[13px] text-gray-500 mt-1">{visit.number}</p>
        {visit.completedAt && (
          <p className="text-[12px] text-gray-400 mt-3">
            {new Date(visit.completedAt).toLocaleString("en-IN")}
          </p>
        )}
      </div>
    );
  }

  if (sigMode) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSigMode(false)} className="text-[13px] text-blue-600">
            ← Back
          </button>
          <h2 className="text-[15px] font-semibold text-gray-900">Client Signature</h2>
          <button onClick={clearSig} className="text-[13px] text-gray-500">Clear</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="text-[13px] text-gray-600 mb-4 text-center">
            Please hand the phone to {visit.project.client.name} to sign below
          </p>
          <div className="bg-white rounded-xl border-2 border-gray-300 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={320}
              height={180}
              className="touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          {!sigDrawn && (
            <p className="text-[11px] text-gray-400 mt-2">Sign in the box above</p>
          )}
        </div>
        <div className="p-4">
          <button
            onClick={handleComplete}
            disabled={completing || pending}
            className="w-full h-14 rounded-xl bg-green-600 text-white text-[16px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {completing || pending ? (
              <><Loader2 size={20} className="animate-spin" /> Completing…</>
            ) : (
              <><CheckCircle2 size={20} /> Complete Visit</>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="text-[11px] text-gray-500 font-mono">{visit.number}</div>
        <h1 className="text-[16px] font-semibold text-gray-900">{visit.project.name}</h1>
        <p className="text-[13px] text-gray-500">{visit.project.client.name}</p>
      </div>

      {/* Status bar */}
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between">
        <span className="text-[12px] text-blue-700 font-medium">
          {completedCount} / {visit.lines.length} lines done
        </span>
        {statusMsg && (
          <span className="text-[12px] text-green-700">{statusMsg}</span>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
        {visit.lines.map((line) => {
          const state = lineStates[line.id]!;
          const isActive = activeLineId === line.id;
          const isDone = state.saved;

          return (
            <div key={line.id} className="bg-white">
              <button
                className="w-full px-4 py-4 flex items-start gap-3 text-left"
                onClick={() => setActiveLineId(isActive ? null : line.id)}
              >
                {isDone ? (
                  <CheckCircle2 size={22} className="text-green-600 shrink-0 mt-0.5" strokeWidth={1.8} />
                ) : (
                  <Circle size={22} className="text-gray-300 shrink-0 mt-0.5" strokeWidth={1.8} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-gray-900">{line.roomLabel}</div>
                  <div className="text-[12px] text-gray-500 truncate">{line.orderLine?.description}</div>
                  {state.dyeLotUsed && (
                    <div className="text-[11px] font-mono text-gray-400 mt-0.5">Lot: {state.dyeLotUsed}</div>
                  )}
                  <div className="text-[12px] text-gray-400 mt-0.5">
                    Planned: {parseFloat(line.plannedQty.toString()).toFixed(2)}
                    {isDone && ` · Installed: ${parseFloat(state.installedQty).toFixed(2)}`}
                  </div>
                </div>
              </button>

              {isActive && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <div className="space-y-3 pt-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Installed Quantity
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        className="w-full h-12 px-3 rounded-lg border border-gray-300 text-[16px] bg-white"
                        value={state.installedQty}
                        onChange={(e) =>
                          setLineStates((prev) => ({
                            ...prev,
                            [line.id]: { ...state, installedQty: e.target.value, saved: false },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Dye Lot Used
                      </label>
                      <input
                        type="text"
                        className="w-full h-12 px-3 rounded-lg border border-gray-300 text-[14px] bg-white font-mono"
                        placeholder="e.g. DL-2024-001"
                        value={state.dyeLotUsed}
                        onChange={(e) =>
                          setLineStates((prev) => ({
                            ...prev,
                            [line.id]: { ...state, dyeLotUsed: e.target.value, saved: false },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Issue (optional)
                      </label>
                      <input
                        type="text"
                        className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[14px] bg-white"
                        placeholder="Note any problem…"
                        value={state.issue}
                        onChange={(e) =>
                          setLineStates((prev) => ({
                            ...prev,
                            [line.id]: { ...state, issue: e.target.value, saved: false },
                          }))
                        }
                      />
                    </div>
                    <button
                      onClick={() => saveLine(line.id)}
                      disabled={pending}
                      className="w-full h-12 rounded-lg bg-blue-600 text-white text-[14px] font-semibold disabled:opacity-60"
                    >
                      {pending ? "Saving…" : "Save Line"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Complete button */}
      <div className="p-4 bg-white border-t border-gray-200">
        <button
          onClick={() => setSigMode(true)}
          className="w-full h-14 rounded-xl bg-green-600 text-white text-[16px] font-semibold flex items-center justify-center gap-2"
        >
          <PenLine size={20} />
          Get Client Signature &amp; Complete
        </button>
      </div>
    </div>
  );
}
