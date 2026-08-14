"use client";

import { useState, useTransition } from "react";
import { raiseInstallSnag, resolveInstallSnag } from "@/modules/install/snag-actions";
import { AlertTriangle, CheckCircle, Plus } from "lucide-react";
import type { SnagRow } from "@/modules/install/detail-queries";

const SNAG_STATUS_COLORS: Record<string, string> = {
  OPEN:        "text-fault bg-fault/10 border-fault/30",
  IN_PROGRESS: "text-heat bg-heat/10 border-heat/30",
  RESOLVED:    "text-solid bg-solid/10 border-solid/30",
  CLOSED:      "text-text-muted bg-surface-2 border-border",
};

interface Props {
  visitId: string;
  projectId: string;
  snags: SnagRow[];
  status: string;
}

export function SnagPanel({ visitId, projectId, snags, status }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError]       = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [description, setDesc]  = useState("");
  const [roomLabel, setRoom]    = useState("");
  const [resolveId, setResolveId]   = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const canRaiseSnag = !["CLOSED", "CANCELLED", "SCHEDULED", "ASSIGNED"].includes(status);

  function raiseSnag() {
    if (!description.trim()) return;
    setError(null);
    startTransition(async () => {
      const r = await raiseInstallSnag({ visitId, projectId, description: description.trim(), roomLabel: roomLabel.trim() || undefined });
      if (r.ok) { setShowForm(false); setDesc(""); setRoom(""); }
      else setError(r.error ?? "Failed");
    });
  }

  function resolve(snagId: string) {
    setError(null);
    startTransition(async () => {
      const r = await resolveInstallSnag({ snagId, visitId, resolutionNote: resolveNote.trim() || undefined });
      if (r.ok) { setResolveId(null); setResolveNote(""); }
      else setError(r.error ?? "Failed");
    });
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-fault" />
          <h2 className="text-[13px] font-semibold text-text">Snags</h2>
          {snags.length > 0 && (
            <span className="font-data text-[10px] text-text-muted">({snags.filter((s) => s.status === "OPEN" || s.status === "IN_PROGRESS").length} open)</span>
          )}
        </div>
        {canRaiseSnag && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[11px] text-fault hover:text-fault/80 transition-colors"
          >
            <Plus size={12} /> Raise Snag
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-4 py-3 border-b border-border bg-fault/5 space-y-2">
          <div>
            <label className="block text-[11px] text-text-muted mb-1">Room (optional)</label>
            <input value={roomLabel} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Master Bedroom"
              className="w-full h-8 px-2.5 rounded-md border border-border bg-surface-2 text-[12px] text-text outline-none focus:border-gold" />
          </div>
          <div>
            <label className="block text-[11px] text-text-muted mb-1">Description *</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Describe the snag…"
              className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none focus:border-gold resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={raiseSnag} disabled={!description.trim() || pending}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-fault/20 border border-fault/40 text-fault text-[12px] font-medium hover:bg-fault/30 disabled:opacity-50">
              <AlertTriangle size={12} /> {pending ? "Saving…" : "Raise Snag"}
            </button>
            <button onClick={() => setShowForm(false)} className="h-8 px-2 text-[12px] text-text-muted hover:text-text">Cancel</button>
          </div>
        </div>
      )}

      {snags.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-text-subtle">No snags raised</div>
      ) : (
        <div className="divide-y divide-border/50">
          {snags.map((snag) => (
            <div key={snag.id} className="px-4 py-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border mr-2 ${SNAG_STATUS_COLORS[snag.status] ?? ""}`}>
                    {snag.status}
                  </span>
                  {snag.roomLabel && <span className="text-[11px] text-text-muted">{snag.roomLabel} · </span>}
                  <span className="text-[12px] text-text">{snag.description}</span>
                </div>
                {snag.status === "OPEN" && (
                  <button onClick={() => setResolveId(snag.id)}
                    className="shrink-0 flex items-center gap-1 text-[11px] text-solid hover:text-solid/80">
                    <CheckCircle size={12} /> Resolve
                  </button>
                )}
              </div>
              {snag.resolutionNote && <p className="text-[11px] text-text-muted pl-1">{snag.resolutionNote}</p>}
              {resolveId === snag.id && (
                <div className="mt-2 space-y-2">
                  <textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} rows={1}
                    placeholder="Resolution note (optional)…"
                    className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none focus:border-gold resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => resolve(snag.id)} disabled={pending}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-solid/20 border border-solid/40 text-solid text-[12px] font-medium hover:bg-solid/30 disabled:opacity-50">
                      <CheckCircle size={12} /> {pending ? "Saving…" : "Mark Resolved"}
                    </button>
                    <button onClick={() => setResolveId(null)} className="h-8 px-2 text-[12px] text-text-muted hover:text-text">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="px-4 py-2 text-[11px] text-fault">{error}</p>}
    </div>
  );
}
