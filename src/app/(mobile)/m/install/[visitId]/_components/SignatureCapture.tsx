"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { startInstallVisit, completeInstallVisit } from "@/modules/install/actions";

interface Props {
  visitId: string;
  visitStatus: string;
  clientName: string;
  pending: boolean;
  onBack: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function SignatureCapture({
  visitId, visitStatus, clientName, pending, onBack, onSuccess, onError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [sigDrawn, setSigDrawn] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [, startTransition] = useTransition();

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

  function endDraw() { isDrawing.current = false; }

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigDrawn(false);
  }

  function handleComplete() {
    if (!visitStatus.includes("PROGRESS") && visitStatus !== "SCHEDULED") return;
    setCompleting(true);
    const signatureKey = sigDrawn && canvasRef.current
      ? canvasRef.current.toDataURL("image/png")
      : undefined;
    startTransition(async () => {
      if (visitStatus === "SCHEDULED") {
        await startInstallVisit({ visitId });
      }
      const result = await completeInstallVisit({ visitId, clientSignatureKey: signatureKey });
      if (result.ok) {
        onSuccess();
      } else {
        onError(result.error ?? "Complete failed");
      }
      setCompleting(false);
    });
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="text-[13px] text-blue-600">
          ← Back
        </button>
        <h2 className="text-[15px] font-semibold text-gray-900">Client Signature</h2>
        <button onClick={clearSig} className="text-[13px] text-gray-500">Clear</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <p className="text-[13px] text-gray-600 mb-4 text-center">
          Please hand the phone to {clientName} to sign below
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
