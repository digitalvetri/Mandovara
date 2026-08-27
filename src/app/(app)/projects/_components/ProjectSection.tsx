"use client";

// One collapsible section of the project workspace.
//
// Owner instruction 2026-08-27: "it is in a flow like if one thing is
// completed we can go to next. But I don't want like this. I need they
// should be listed. If I click, the separate items belonging to that
// should be displayed below that."
//
// The page used to lead with a single "next action" that assumed one
// correct order — quote, advance, install, complete. Real projects don't
// behave: the advance arrives before the final quote is approved, one
// room is installed while another is still being measured. Gating on a
// sequence meant the work you actually needed was often two clicks away
// behind a step you hadn't done yet.
//
// Everything is now reachable, always. What a section shows when closed
// is its *state* — "₹2,40,000 of ₹6,50,000 received" — so the page reads
// as a status board at a glance and opens into detail on demand.

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export type SectionTone = "neutral" | "good" | "warn" | "bad" | "accent";

const TONE_TEXT: Record<SectionTone, string> = {
  neutral: "text-text-dim",
  good:    "text-good",
  warn:    "text-warn",
  bad:     "text-bad",
  accent:  "text-accent",
};

interface Props {
  icon:     ReactNode;
  title:    string;
  /** State when collapsed — a real number or status, never a word like "details". */
  summary:  string;
  tone?:    SectionTone;
  /** Small count shown beside the title, e.g. number of invoices. */
  count?:   number;
  defaultOpen?: boolean;
  /** Right-aligned control that works without opening the section. */
  action?:  ReactNode;
  children: ReactNode;
}

export function ProjectSection({
  icon, title, summary, tone = "neutral", count,
  defaultOpen = false, action, children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-[12px] border border-rule bg-surface">
      <div className="flex items-center gap-2 px-4 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left transition-colors hover:opacity-80"
        >
          <ChevronRight
            size={13}
            className={`shrink-0 text-text-dim transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="shrink-0 text-text-dim">{icon}</span>
          <span className="shrink-0 text-[13px] font-medium text-text">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="tabular shrink-0 text-[11px] text-text-faint">{count}</span>
          )}
          <span className={`tabular ml-auto truncate pl-3 text-right text-[12px] ${TONE_TEXT[tone]}`}>
            {summary}
          </span>
        </button>
        {action && <div className="shrink-0 py-3.5">{action}</div>}
      </div>

      {open && (
        <div className="border-t border-rule px-4 py-4 sm:px-5">
          {children}
        </div>
      )}
    </section>
  );
}
