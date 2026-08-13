"use client";

// Reads local conflicts from IndexedDB, joins them against the
// server's current state via fetchServerItemsForConflict, and hands
// each pair to a ConflictCard for review.
//
// On mount + on router refresh the list re-fetches. Discarding a
// conflict removes it from local storage; promoting sends the local
// payload through the promote server action.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { listConflicts, type ConflictRow } from "@/lib/measure-outbox";
import { fetchServerItemsForConflict } from "@/modules/measurement/conflict-actions";
import type { ServerItemSnapshot } from "@/modules/measurement/conflict-queries";
import { ConflictCard } from "./ConflictCard";

type Loaded = {
  local:  ConflictRow;
  server: ServerItemSnapshot;
};

export function ConflictReview() {
  const router = useRouter();
  const [rows, setRows]       = useState<Loaded[] | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const local  = await listConflicts();
      const server = local.length > 0
        ? await fetchServerItemsForConflict(local.map((c) => c.id))
        : [];
      const byId = new Map(server.map((s) => [s.clientCuid, s] as const));
      setRows(local.map((l) => ({
        local:  l,
        server: byId.get(l.id) ?? { clientCuid: l.id, exists: false },
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conflicts");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-ink flex flex-col text-text">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-surface border-b border-rule px-3 py-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-11 w-11 grid place-items-center rounded-[8px] hover:bg-surface-hover"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center leading-tight">
          <div className="text-[11px] uppercase tracking-[0.08em] text-text-dim">
            Sync
          </div>
          <div className="text-[13px] font-medium">Conflict review</div>
        </div>
        <div className="w-11" aria-hidden />
      </header>

      <main className="flex-1 px-3 py-4">
        {error && (
          <div className="mb-3 rounded-[8px] border border-fault/40 bg-fault/10 px-3 py-2 text-[12px] text-fault">
            {error}
          </div>
        )}

        {rows === null ? (
          <div className="rounded-[10px] border border-rule bg-surface px-6 py-10 text-center">
            <Loader2 size={20} className="mx-auto animate-spin text-text-dim" />
            <div className="mt-3 text-[12px] text-text-dim">Loading conflicts…</div>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState onRefresh={load} />
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 text-[11.5px] text-text-dim">
              <AlertTriangle size={14} className="text-fault" />
              <span>
                {rows.length} row{rows.length === 1 ? "" : "s"} rejected by the server.
                Discard to keep what the server has, promote to override with a reason.
              </span>
            </div>

            <div className="space-y-3">
              {rows.map((r) => (
                <ConflictCard
                  key={r.local.id}
                  local={r.local}
                  server={r.server}
                  onResolved={load}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="rounded-[10px] border border-rule bg-surface px-6 py-10 text-center">
      <CheckCircle2 size={24} className="mx-auto text-solid-strong mb-3" />
      <div className="text-[13px] text-text mb-1">No conflicts</div>
      <div className="text-[11.5px] text-text-dim">
        Every measurement synced cleanly. If you were expecting one to
        show up, pull the queue banner to force a fresh drain, then
        refresh.
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-4 rounded-[8px] border border-rule px-3 py-1.5 text-[11.5px] text-text hover:border-gold hover:text-gold"
      >
        Refresh
      </button>
    </div>
  );
}
