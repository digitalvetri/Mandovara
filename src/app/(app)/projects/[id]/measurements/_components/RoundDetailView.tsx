"use client";

// §5.2 detail — room accordion, item cards with live CalcResult and
// warnings (plain English, spec §5.2), Approve action gated by
// permission + status (SUBMITTED only).

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { submitMeasurementRound, approveMeasurementRound } from "@/modules/measurement/actions";
import type { RoundDetail } from "@/modules/measurement/queries";
import { StatusPill } from "./StatusPill";
import { ItemCard } from "./ItemCard";
import { AddItemPanel } from "./AddItemPanel";
import { SimpleMeasurementEntry } from "@/components/measurement/SimpleMeasurementEntry";
import { AdvancedEntryDisclosure } from "./AdvancedEntryDisclosure";

interface RoundDetailViewProps {
  round: RoundDetail;
  rooms: { id: string; name: string; floorLabel: string | null; sortOrder: number }[];
}

export function RoundDetailView({ round, rooms }: RoundDetailViewProps) {
  const [status, setStatus] = useState(round.status);
  const [busyKind, setBusyKind] = useState<"submit" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemCount = round.itemsByRoom.reduce((n, r) => n + r.items.length, 0);
  const canSubmit  = status === "DRAFT"     && itemCount > 0;
  const canApprove = status === "SUBMITTED";

  async function onSubmit() {
    setError(null);
    setBusyKind("submit");
    const r = await submitMeasurementRound({ measurementId: round.id });
    if (r.ok) setStatus("SUBMITTED");
    else setError(r.error ?? "Could not submit round");
    setBusyKind(null);
  }

  async function onApprove() {
    setError(null);
    setBusyKind("approve");
    const r = await approveMeasurementRound({ measurementId: round.id });
    if (r.ok) setStatus("APPROVED");
    else setError(r.error ?? "Could not approve round");
    setBusyKind(null);
  }

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex items-center justify-between rounded-[10px] border border-rule bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <StatusPill status={status} />
          <div className="text-[11.5px] text-text-dim">
            Measured by <span className="text-text">{round.measuredByName}</span>
            {" · "}visited <span className="tabular text-text">{formatDate(round.visitedAt)}</span>
            {round.approvedByName && (
              <>{" · "}approved by <span className="text-text">{round.approvedByName}</span></>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={busyKind !== null}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-rule bg-transparent px-3 py-1.5 text-[11.5px] font-medium text-text hover:border-gold hover:text-gold disabled:opacity-60 transition-colors"
            >
              {busyKind === "submit" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Submit round
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              onClick={onApprove}
              disabled={busyKind !== null}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-gold px-3 py-1.5 text-[11.5px] font-medium text-ink hover:bg-gold-strong disabled:opacity-60 transition-colors"
            >
              {busyKind === "approve" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Approve
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-[6px] border border-fault/40 bg-fault/10 px-3 py-2 text-[11.5px] text-fault">
          {error}
        </div>
      )}

      {/* Room accordion */}
      {round.itemsByRoom.length === 0 ? (
        <EmptyRound />
      ) : (
        <div className="space-y-3">
          {round.itemsByRoom.map((room) => (
            <div key={room.roomId} className="rounded-[10px] border border-rule bg-surface">
              <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-medium text-text">{room.roomName}</div>
                  {room.floorLabel && (
                    <div className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-dim">
                      {room.floorLabel}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-text-dim tabular">
                  {room.items.length} {room.items.length === 1 ? "item" : "items"}
                </div>
              </div>
              <div className="space-y-3 p-4">
                {room.items.map((it) => (
                  <ItemCard key={it.id} item={it} measurementId={round.id} editable={status === "DRAFT"} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add item.
          The four-field form leads: place, quantity, width, height, and
          it invents a room rather than stopping to demand one. The full
          panel — rooms, surface, family, heading/lay/mount — is still
          here, one click down, because nothing has been taken away from
          the people who use it. */}
      {status === "DRAFT" && (
        <div className="space-y-2.5">
          <SimpleMeasurementEntry measurementId={round.id} />
          <AdvancedEntryDisclosure>
            <AddItemPanel measurementId={round.id} projectId={round.subject.id} rooms={rooms} />
          </AdvancedEntryDisclosure>
        </div>
      )}

      {round.notes && (
        <div className="rounded-[10px] border border-rule bg-surface px-4 py-3 text-[12px] text-text-dim">
          <span className="mr-2 text-[10.5px] uppercase tracking-[0.06em] text-text-faint">Notes</span>
          {round.notes}
        </div>
      )}
    </div>
  );
}

function EmptyRound() {
  return (
    <div className="rounded-[10px] border border-rule bg-surface px-6 py-10 text-center">
      <div className="text-[13px] text-text mb-1">No items yet</div>
      <div className="text-[11.5px] text-text-dim">
        Add the first window, wall or floor below. The engine computes material as
        you type.
      </div>
    </div>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
