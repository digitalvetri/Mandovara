// /make — the cut & stitch kanban (§5.2 Phase 5b).
//
// Six swim-lanes (QUEUED → CUTTING → STITCHING → FINISHING → QC →
// READY). DELIVERED jobs drop off the board — status is terminal
// and the tailor doesn't need to look at them again.
//
// The cards are read-only here; click a card to open the detail page
// where status transitions and per-line captures happen. Kanban
// intentionally stays simple in 5b — no drag-drop, no in-place edits.
// The optimisation loop is "look at the board → tap a card → do the
// work → back to the board", not "reorganise the board".

import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { formatDate } from "@/kernel/datetime";
import { shortNumber } from "@/lib/short-number";
import { listMakeJobs, type KanbanCard } from "@/modules/make/queries";
import type { MakeJobStatus } from "@/modules/make/schema";

export const dynamic = "force-dynamic";

// Order + labels mirror the transition graph in modules/make/status.ts.
const LANES: { key: Exclude<MakeJobStatus, "DELIVERED">; label: string; hint: string }[] = [
  { key: "QUEUED",    label: "Queued",      hint: "waiting for cutting table" },
  { key: "CUTTING",   label: "Cutting",     hint: "fabric on the table" },
  { key: "STITCHING", label: "Stitching",   hint: "panels being sewn" },
  { key: "FINISHING", label: "Finishing",   hint: "eyelets · trim · heading" },
  { key: "QC",        label: "QC",          hint: "supervisor check" },
  { key: "READY",     label: "Ready",       hint: "packed for install" },
];

export default async function MakePage() {
  const ctx = await devContext();
  const board = await listMakeJobs(ctx);
  const totalOpen = LANES.reduce((n, l) => n + board[l.key].length, 0);

  return (
    <>
      <Topbar
        title="Make · Cut & Stitch"
        eyebrow={`${totalOpen} job${totalOpen === 1 ? "" : "s"} on the floor`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pb-10">
        {LANES.map((lane) => (
          <Lane
            key={lane.key}
            label={lane.label}
            hint={lane.hint}
            cards={board[lane.key]}
          />
        ))}
      </div>
    </>
  );
}

function Lane({
  label, hint, cards,
}: { label: string; hint: string; cards: KanbanCard[] }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule flex flex-col min-h-[220px]">
      <div className="px-3 pt-3 pb-2 border-b border-rule flex items-baseline justify-between">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            {label}
          </div>
          <div className="text-[10px] text-text-faint mt-0.5">{hint}</div>
        </div>
        <div className="tabular text-[13px] font-medium text-text">
          {cards.length}
        </div>
      </div>
      {cards.length === 0 ? (
        <div className="flex-1 grid place-items-center text-[11px] text-text-faint py-8">
          none
        </div>
      ) : (
        <ul className="p-2 space-y-2 flex-1">
          {cards.map((c) => <Card key={c.id} card={c} />)}
        </ul>
      )}
    </div>
  );
}

function Card({ card }: { card: KanbanCard }) {
  // Aged pill turns red past 7 days, amber past 3. The tailor wants
  // to see stuck jobs at a glance — colour is the fastest signal.
  const agedTone =
    card.agedDays >= 7 ? "text-bad bg-bad/[0.10]"
    : card.agedDays >= 3 ? "text-heat bg-heat/[0.10]"
    : "text-text-faint bg-white/[0.03]";

  return (
    <li>
      <Link
        href={`/make/${card.id}` as Route}
        className="block rounded-[10px] border border-rule bg-bg/50 hover:bg-bg hover:border-accent/40 transition-colors p-3"
      >
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <div className="tabular text-[11.5px] font-medium text-text">
            {shortNumber(card.number, "MJ-")}
          </div>
          <div className={`tabular text-[10px] px-1.5 py-0.5 rounded-[4px] ${agedTone}`}>
            {card.agedDays === 0 ? "today" : `${card.agedDays}d`}
          </div>
        </div>
        <div className="text-[12.5px] text-text leading-tight truncate">
          {card.clientName}
        </div>
        <div className="text-[10.5px] text-text-dim tabular mt-1 flex items-center gap-2">
          <span>{shortNumber(card.orderNumber, "SO-")}</span>
          <span className="text-text-faint">·</span>
          <span>{card.lineCount} line{card.lineCount === 1 ? "" : "s"}</span>
        </div>
        {card.targetDate && (
          <div className="text-[10.5px] text-text-faint tabular mt-1">
            target {formatDate(card.targetDate)}
          </div>
        )}
      </Link>
    </li>
  );
}
