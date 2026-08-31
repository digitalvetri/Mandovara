"use client";

// "Give out this catalogue" — the one form in the shelf.
//
// Split from CatalogueShelf.tsx to keep that file under the §10 300-line
// ceiling, and because issuing is its own idea: the shelf answers "where is
// it", this answers "who is taking it, and when is it due back".

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { issueCatalogue } from "@/modules/catalog/lending-actions";
import type { CatalogueShelfRow } from "@/modules/catalog/lending-queries";

export function IssueDialog({
  row, onClose, onError,
}: {
  row: CatalogueShelfRow;
  onClose: () => void;
  onError: (m: string | null) => void;
}) {
  const [name, setName]   = useState("");
  const [type, setType]   = useState<"CLIENT" | "ARCHITECT" | "STAFF" | "OTHER">("CLIENT");
  const [due, setDue]     = useState("");
  const [notes, setNotes] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocal(null);
    if (!name.trim()) { setLocal("Enter who is taking it."); return; }
    start(async () => {
      const r = await issueCatalogue({
        catalogueId: row.id,
        holderName:  name,
        holderType:  type,
        ...(due ? { dueAt: due } : {}),
        ...(notes.trim() ? { notes } : {}),
      });
      if (!r.ok) { setLocal(r.error ?? "Could not give that out."); return; }
      onError(null);
      onClose();
    });
  }

  const field =
    "h-10 w-full rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text outline-none focus:border-gold";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label={`Give out ${row.name}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !pending && onClose()} />
      <div className="relative w-full max-w-md overflow-hidden rounded-[14px] border border-rule bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-rule px-5 py-3.5">
          <div>
            <h3 className="text-[14px] font-semibold text-text">Give out this catalogue</h3>
            <p className="mt-0.5 truncate text-[12px] text-text-dim">{row.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={pending} aria-label="Cancel"
            className="grid h-7 w-7 place-items-center rounded-[6px] text-text-dim hover:bg-surface-2 hover:text-text disabled:opacity-50">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3.5 p-5">
          <div>
            <label className="mb-1 block text-[11px] text-text-dim" htmlFor="cat-holder">
              Who is taking it? <span className="text-fault">*</span>
            </label>
            <input
              id="cat-holder" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Name of the client, architect or person" maxLength={80}
              className={field} autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-text-dim" htmlFor="cat-type">They are a</label>
              <select id="cat-type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className={field}>
                <option value="CLIENT">Client</option>
                <option value="ARCHITECT">Architect</option>
                <option value="STAFF">Staff</option>
                <option value="OTHER">Someone else</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-text-dim" htmlFor="cat-due">Back by (optional)</label>
              <input id="cat-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${field} tabular-nums`} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-text-dim" htmlFor="cat-notes">Note (optional)</label>
            <input
              id="cat-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. for the Alila bedroom shortlist" maxLength={200} className={field}
            />
          </div>

          {local && (
            <div className="rounded-[8px] border border-fault/30 bg-fault/5 px-3 py-2 text-[11.5px] text-fault">{local}</div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={pending}
              className="h-10 rounded-[8px] border border-rule px-4 text-[12.5px] text-text-dim hover:text-text disabled:opacity-50 sm:border-transparent">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-gold px-5 text-[13px] font-semibold text-ink hover:bg-gold-strong disabled:opacity-60">
              {pending && <Loader2 size={12} className="animate-spin" />}
              Give it out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
