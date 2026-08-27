"use client";

// One item in the verification queue.
//
// Ticking the box does not just mark it seen — it opens two fields for
// what the label actually said. That answer is the entire reason someone
// walked to the showroom; without it the item cannot be added to the
// catalogue and reappears on this list next month.
//
// The fields are optional. A person holding a roll with a half-legible
// label should be able to record "checked, brand unreadable" rather than
// being blocked, so Save works with them empty and the note carries the
// rest.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Undo2, X } from "lucide-react";
import {
  verifyPendingItem, discardPendingItem, reopenPendingItem,
} from "@/modules/pending-stock/actions";
import type { PendingRow as Row } from "@/modules/pending-stock/queries";

export function PendingRow({ row, canEdit }: { row: Row; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState(row.foundBrand ?? "");
  const [collection, setCollection] = useState(row.foundCollection ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const done      = row.status !== "PENDING";
  const discarded = row.status === "DISCARDED";

  function save(): void {
    setError(null);
    start(async () => {
      const res = await verifyPendingItem({ id: row.id, brand, collection, note });
      if (!res.ok) { setError(res.error ?? "Could not save."); return; }
      setOpen(false);
      router.refresh();
    });
  }

  function discard(): void {
    setError(null);
    start(async () => {
      const res = await discardPendingItem({ id: row.id, note });
      if (!res.ok) { setError(res.error ?? "Could not save."); return; }
      setOpen(false);
      router.refresh();
    });
  }

  function reopen(): void {
    setError(null);
    start(async () => {
      await reopenPendingItem(row.id);
      setBrand(""); setCollection(""); setNote("");
      router.refresh();
    });
  }

  return (
    <li className={`border-b border-rule/60 last:border-0 ${done ? "bg-surface-2/40" : ""}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          disabled={!canEdit || pending}
          onClick={() => (done ? reopen() : setOpen((v) => !v))}
          aria-pressed={done}
          aria-label={done ? `Undo ${row.code}` : `Check ${row.code}`}
          className={
            "mt-0.5 grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[5px] border transition-colors " +
            (discarded ? "border-text-dim bg-text-dim text-white"
             : done    ? "border-good bg-good text-white"
                       : "border-rule hover:border-good") +
            (canEdit ? " cursor-pointer" : " cursor-default opacity-60")
          }
        >
          {pending ? <Loader2 size={12} className="animate-spin" />
           : discarded ? <X size={12} strokeWidth={3} />
           : done ? <Check size={12} strokeWidth={3} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-medium ${done ? "text-text-dim line-through" : "text-text"}`}>
            {row.catalogueName ?? <span className="italic font-normal">No name on the sheet</span>}
          </div>
          <div className="tabular-nums mt-0.5 font-mono text-[11px] text-text-dim">
            {row.code}
            {row.lengthInches && ` · ${row.lengthInches} in`}
            {" · "}{row.qty} {row.unit.toLowerCase()}
          </div>

          {!done && (
            <div className="mt-1 text-[12px] text-text">{row.confirmNeeded}</div>
          )}

          {/* What was found, once it is known. */}
          {done && !discarded && (row.foundBrand || row.foundCollection || row.note) && (
            <div className="mt-1 text-[12px] text-text-dim">
              {[row.foundBrand, row.foundCollection].filter(Boolean).join(" · ")}
              {row.note && <span className="italic"> — {row.note}</span>}
            </div>
          )}
          {discarded && (
            <div className="mt-1 text-[12px] text-text-dim">
              Closed without importing{row.note ? ` — ${row.note}` : ""}
            </div>
          )}
          {done && row.verifiedByName && (
            <div className="mt-0.5 text-[11px] text-text-faint">
              {row.verifiedByName}
              {row.verifiedAt && ` · ${row.verifiedAt.toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", timeZone: "Asia/Kolkata",
              })}`}
            </div>
          )}

          {/* The answer form. */}
          {open && !done && (
            <div className="mt-2.5 space-y-2 rounded-[8px] border border-rule bg-surface-2/60 p-3">
              <div className="text-[11.5px] text-text-dim">What does the label say?</div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={brand} onChange={(e) => setBrand(e.target.value)}
                  placeholder="Brand" autoFocus maxLength={120}
                  className="h-9 min-w-0 flex-1 rounded-[7px] border border-rule bg-surface px-3 text-[12.5px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
                />
                <input
                  value={collection} onChange={(e) => setCollection(e.target.value)}
                  placeholder="Collection" maxLength={120}
                  className="h-9 min-w-0 flex-1 rounded-[7px] border border-rule bg-surface px-3 text-[12.5px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
                />
              </div>
              <input
                value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Anything else worth noting (optional)" maxLength={500}
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                className="h-9 w-full rounded-[7px] border border-rule bg-surface px-3 text-[12.5px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button" disabled={pending} onClick={save}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[7px] bg-good px-4 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pending && <Loader2 size={12} className="animate-spin" />}
                  Checked
                </button>
                <button
                  type="button" disabled={pending} onClick={discard}
                  className="h-9 rounded-[7px] border border-rule px-3.5 text-[12.5px] text-text-dim transition-colors hover:border-bad hover:text-bad"
                  title="The roll is not there, or nobody can identify it"
                >
                  Can&apos;t identify
                </button>
                <button
                  type="button" disabled={pending} onClick={() => setOpen(false)}
                  className="h-9 px-2 text-[12.5px] text-text-dim hover:text-text"
                >
                  Cancel
                </button>
              </div>
              {error && <div className="text-[11.5px] text-bad">{error}</div>}
            </div>
          )}
        </div>

        {done && canEdit && (
          <button
            type="button" disabled={pending} onClick={reopen}
            className="mt-0.5 shrink-0 text-text-faint transition-colors hover:text-text"
            aria-label={`Put ${row.code} back on the list`}
            title="Put back on the list"
          >
            <Undo2 size={13} />
          </button>
        )}
      </div>
    </li>
  );
}
