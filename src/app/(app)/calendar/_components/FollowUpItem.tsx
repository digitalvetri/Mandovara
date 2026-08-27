"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { RotateCcw, ExternalLink, MapPin } from "lucide-react";
import { rescheduleFollowUp } from "@/modules/followups/actions";

export interface CalendarItem {
  id:        string;
  dueAt:     string;
  kind:      "followup" | "sitevisit";
  note:      string;
  refType:   string;
  refId:     string;
  refLabel:  string;
  ownerName: string;
  status:    "OPEN" | "OVERDUE" | "COMPLETED";
}

// Follow-ups use accent (teal); site visits use heat (amber) to distinguish
const STATUS_CLS: Record<string, Record<string, string>> = {
  followup: {
    OPEN:      "bg-accent/12 text-accent",
    OVERDUE:   "bg-fault/12 text-fault",
    COMPLETED: "bg-good/12 text-good",
  },
  sitevisit: {
    OPEN:      "bg-heat/12 text-heat",
    OVERDUE:   "bg-fault/12 text-fault",
    COMPLETED: "bg-good/12 text-good",
  },
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open", OVERDUE: "Overdue", COMPLETED: "Done",
};
const REF_HREF: Record<string, (id: string) => Route> = {
  LEAD:      (id) => `/leads/${id}` as Route,
  CLIENT:    (id) => `/clients/${id}` as Route,
  QUOTATION: (id) => `/quotations/${id}` as Route,
  PROJECT:   (id) => `/projects/${id}` as Route,
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours(); const m = d.getMinutes();
  if (h === 0 && m === 0) return "—";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

export function FollowUpItem({ item, onRescheduled }: { item: CalendarItem; onRescheduled: () => void }) {
  const [, startTx] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(item.dueAt.slice(0, 10));
  const [time, setTime] = useState(() => {
    const t = item.dueAt.slice(11, 16);
    return t || "10:00";
  });
  const [note, setNote] = useState("");

  const href      = REF_HREF[item.refType]?.(item.refId);
  const kindMap   = STATUS_CLS[item.kind] ?? STATUS_CLS.followup!;
  const tone      = (kindMap ?? STATUS_CLS.followup!)[item.status] ?? "bg-surface-2 text-text-dim";
  const isSiteVisit = item.kind === "sitevisit";

  function submitReschedule(e: React.FormEvent) {
    e.preventDefault();
    startTx(async () => {
      await rescheduleFollowUp({ id: item.id, dueAt: `${date}T${time}:00`, note });
      setOpen(false);
      onRescheduled();
    });
  }

  return (
    <div className="border-b border-rule/60 last:border-0 py-3 px-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.07em] px-1.5 py-0.5 rounded-[4px] ${tone}`}>
              {isSiteVisit ? "Site Visit" : (STATUS_LABEL[item.status] ?? item.status)}
            </span>
            {isSiteVisit && <MapPin size={11} strokeWidth={2} className="text-heat shrink-0" />}
            <span className="text-[13.5px] font-semibold text-text">{item.refLabel}</span>
            <span className="text-[11.5px] text-text-dim tabular font-data">{fmtTime(item.dueAt)}</span>
          </div>
          {/* Note */}
          {item.note && (
            <div className="mt-0.5 text-[12px] text-text-dim truncate">
              {isSiteVisit ? item.note : item.note}
            </div>
          )}
          {/* Owner + ref type */}
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-faint">
            <span className="w-4 h-4 rounded-full bg-accent/15 text-accent text-[8.5px] font-bold inline-flex items-center justify-center shrink-0">
              {item.ownerName.charAt(0).toUpperCase()}
            </span>
            <span>{item.ownerName}</span>
            <span className="text-text-faint/50">·</span>
            <span className="capitalize">{item.refType.toLowerCase()}</span>
          </div>
        </div>

        {/* Actions — site visits have their own reschedule flow, so only show the link */}
        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
          {!isSiteVisit && (
            <button type="button" onClick={() => setOpen(v => !v)} title="Reschedule"
                    className="h-7 w-7 grid place-items-center rounded-[6px] text-text-dim hover:text-text hover:bg-surface-2 transition-colors">
              <RotateCcw size={12} strokeWidth={2} />
            </button>
          )}
          {href && (
            <Link href={href} title="Open" onClick={e => e.stopPropagation()}
                  className="h-7 w-7 grid place-items-center rounded-[6px] text-text-dim hover:text-accent hover:bg-surface-2 transition-colors">
              <ExternalLink size={12} strokeWidth={2} />
            </Link>
          )}
        </div>
      </div>

      {/* Reschedule form — follow-ups only */}
      {open && !isSiteVisit && (
        <form onSubmit={submitReschedule} className="mt-3 p-3 bg-surface-2 rounded-[8px] space-y-2">
          <div className="flex gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                   className="flex-1 h-[30px] px-2.5 bg-surface border border-rule rounded-[6px] text-[12px] tabular outline-none focus:border-accent" />
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
                   className="w-[100px] h-[30px] px-2.5 bg-surface border border-rule rounded-[6px] text-[12px] tabular outline-none focus:border-accent" />
          </div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Reason (optional)" maxLength={200}
                 className="w-full h-[30px] px-2.5 bg-surface border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)}
                    className="h-7 px-2.5 text-[11.5px] text-text-dim hover:text-text transition-colors">Cancel</button>
            <button type="submit"
                    className="h-7 px-3 bg-accent text-white text-[11.5px] font-medium rounded-[5px] hover:bg-accent-hover transition-colors">Save</button>
          </div>
        </form>
      )}
    </div>
  );
}
