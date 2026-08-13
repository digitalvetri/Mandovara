"use client";

// One conflict row. Server column left, local column right. Fields
// that differ get a fault-tinted background so the difference is
// scan-able in one glance. Actions live at the bottom — discard
// (server default) or promote (with a reason).

import { useState, useTransition } from "react";
import { CircleX, ArrowRight, Loader2 } from "lucide-react";
import type { ConflictRow } from "@/lib/measure-outbox";
import type { ServerItemSnapshot } from "@/modules/measurement/conflict-queries";
import { markSent as discardConflict } from "@/lib/measure-outbox";
import { promoteLocalItem } from "@/modules/measurement/conflict-actions";

interface ConflictCardProps {
  local:      ConflictRow;
  server:     ServerItemSnapshot;
  onResolved: () => void;
}

// Fields we render + compare. Keep in sync with the payload shape;
// order is display order.
type FieldKey = "label" | "surface" | "family" | "widthMm" | "heightMm" | "quantity"
              | "headingType" | "fullness" | "layPattern" | "mountType";

const LABEL: Record<FieldKey, string> = {
  label: "Label", surface: "Surface", family: "Family",
  widthMm: "Width (mm)", heightMm: "Height (mm)", quantity: "Qty",
  headingType: "Heading", fullness: "Fullness",
  layPattern: "Lay", mountType: "Mount",
};

interface LocalPayloadShape {
  label?:       string;
  surface?:     string;
  family?:      string;
  widthMm?:     number;
  heightMm?:    number;
  quantity?:    number;
  headingType?: string | null;
  fullness?:    number | null;
  layPattern?:  string | null;
  mountType?:   string | null;
}

export function ConflictCard({ local, server, onResolved }: ConflictCardProps) {
  const [reasonOpen, setReasonOpen]     = useState(false);
  const [reason, setReason]             = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [pending, start]                = useTransition();

  const payload = local.ours as LocalPayloadShape;

  const rows: { key: FieldKey; localVal: string; serverVal: string; differs: boolean }[] = FIELD_ORDER.map((key) => {
    const l = displayLocal(payload, key);
    const s = displayServer(server, key);
    return { key, localVal: l, serverVal: s, differs: l !== "—" && s !== "—" && l !== s };
  }).filter((r) => r.localVal !== "—" || r.serverVal !== "—");

  async function onDiscard(): Promise<void> {
    setError(null);
    start(async () => {
      // discardConflict is markSent under the hood — both cases delete
      // the id from the conflicts store since it's the same key path.
      await discardConflict(local.id);
      onResolved();
    });
  }

  async function onPromote(): Promise<void> {
    setError(null);
    start(async () => {
      const res = await promoteLocalItem({ payload: local.ours, reason: reason.trim() });
      if (!res.ok) {
        setError(res.error ?? "Could not promote");
        return;
      }
      await discardConflict(local.id);
      setReasonOpen(false);
      setReason("");
      onResolved();
    });
  }

  return (
    <article className="rounded-[10px] border border-fault/40 bg-surface overflow-hidden">
      {/* Header — server error, project, round */}
      <div className="border-b border-rule bg-fault/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <CircleX size={14} className="text-fault" />
          <div className="text-[12px] text-fault flex-1">{local.serverError}</div>
        </div>
        {server.exists && (
          <div className="mt-1 text-[10.5px] text-text-dim tabular">
            {server.projectName} · {server.clientName} · round {server.roundNumber} · {server.roundStatus?.toLowerCase()}
          </div>
        )}
      </div>

      {/* Side-by-side field table */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-[80px_1fr_18px_1fr] gap-y-1.5 text-[11.5px]">
          <div className="text-text-faint" />
          <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Server</div>
          <div />
          <div className="text-[10.5px] uppercase tracking-[0.06em] text-gold-strong">Local</div>

          {rows.map((r) => (
            <FieldRow key={r.key} label={LABEL[r.key]} local={r.localVal} server={r.serverVal} differs={r.differs} />
          ))}
        </div>
      </div>

      {/* Reason prompt (opens on Promote) */}
      {reasonOpen && (
        <div className="border-t border-rule px-4 py-3 bg-surface-2/60">
          <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mb-1">
            Why override the server?
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Client agreed to new dims — round is in QC and needs a v2."
            maxLength={500}
            className="w-full min-h-[72px] rounded-[8px] border border-rule bg-transparent p-2 text-[12.5px] text-text placeholder:text-text-faint"
            autoFocus
          />
          <div className="mt-1 flex justify-between text-[10.5px] text-text-faint">
            <span>Written to the audit log — required for approvers to review later.</span>
            <span className="tabular">{reason.trim().length}/500</span>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-[11.5px] text-fault border-t border-rule">{error}</div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-rule bg-surface-2 px-4 py-2.5">
        <button
          type="button"
          onClick={onDiscard}
          disabled={pending}
          className="min-h-[44px] flex-1 rounded-[8px] border border-rule text-[12.5px] text-text-dim hover:text-text disabled:opacity-60"
        >
          Discard local
        </button>
        {!reasonOpen ? (
          <button
            type="button"
            onClick={() => setReasonOpen(true)}
            disabled={pending}
            className="min-h-[44px] flex-1 rounded-[8px] bg-gold text-ink text-[12.5px] font-medium hover:bg-gold-strong disabled:opacity-60 inline-flex items-center justify-center gap-1"
          >
            Promote local <ArrowRight size={12} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onPromote}
            disabled={pending || reason.trim().length < 5}
            className="min-h-[44px] flex-1 rounded-[8px] bg-gold text-ink text-[12.5px] font-medium disabled:opacity-40 inline-flex items-center justify-center gap-1"
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            Save promotion
          </button>
        )}
      </div>
    </article>
  );
}

const FIELD_ORDER: readonly FieldKey[] = [
  "label", "surface", "family",
  "widthMm", "heightMm", "quantity",
  "headingType", "fullness", "layPattern", "mountType",
];

function displayLocal(p: LocalPayloadShape, key: FieldKey): string {
  const v = p[key];
  if (v == null || v === "") return "—";
  if (typeof v === "number") return String(v);
  return String(v);
}

function displayServer(s: ServerItemSnapshot, key: FieldKey): string {
  if (!s.exists) return "—";
  const v = s[key];
  if (v == null || v === "") return "—";
  return String(v);
}

interface FieldRowProps {
  label:   string;
  local:   string;
  server:  string;
  differs: boolean;
}

function FieldRow({ label, local, server, differs }: FieldRowProps) {
  return (
    <>
      <div className="pt-1 text-text-faint text-[10.5px] uppercase tracking-[0.05em] pr-2">{label}</div>
      <div className={`pt-1 px-1.5 rounded-[4px] tabular ${differs ? "bg-fault/10 text-fault" : "text-text-dim"}`}>{server}</div>
      <div className="pt-1 text-text-faint text-center">→</div>
      <div className={`pt-1 px-1.5 rounded-[4px] tabular ${differs ? "bg-fault/10 text-text font-medium" : "text-text-dim"}`}>{local}</div>
    </>
  );
}
