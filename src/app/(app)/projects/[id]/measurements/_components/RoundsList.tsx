"use client";

// §5.1 Rounds list — every measurement round for a project, superseded
// rounds collapsed under their replacement so the history is visible
// but does not clutter the primary rows.
//
// Client component so the disclosure toggles are interactive without a
// round-trip. Data comes pre-shaped from the server via the parent
// page — this component does not fetch.

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, History, MapPin } from "lucide-react";
import type { RoundListGroup } from "@/modules/measurement/queries";
import { StatusPill } from "./StatusPill";

interface RoundsListProps {
  projectId: string;
  groups:    RoundListGroup[];
}

export function RoundsList({ projectId, groups }: RoundsListProps) {
  if (groups.length === 0) {
    return (
      <div className="rounded-[10px] border border-rule bg-surface px-6 py-10 text-center">
        <MapPin size={20} className="mx-auto mb-3 text-text-dim" />
        <div className="text-[13px] text-text mb-1">No measurement rounds yet</div>
        <div className="text-[11.5px] text-text-dim">
          Start a round to capture site dimensions. Every quotation line downstream
          traces back to one item you measure here.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[10px] border border-rule bg-surface">
      <table className="min-w-[720px] w-full text-[12.5px]">
        <thead className="bg-surface-2 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Number</th>
            <th className="px-3 py-2 text-left font-medium">Visited</th>
            <th className="px-3 py-2 text-left font-medium">By</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Items</th>
            <th className="px-3 py-2 text-left font-medium">Rooms</th>
            <th className="px-3 py-2 text-right font-medium">Rev</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <RoundRowGroup key={g.head.id} projectId={projectId} group={g} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoundRowGroup({ projectId, group }: { projectId: string; group: RoundListGroup }) {
  const [expanded, setExpanded] = useState(false);
  const hasHistory = group.history.length > 0;

  return (
    <>
      <tr className="border-t border-rule hover:bg-surface-hover">
        <td className="px-3 py-2.5">
          <Link
            href={`/projects/${projectId}/measurements/${group.head.id}` as Route}
            className="tabular font-medium text-text hover:text-gold"
          >
            {shortNumber(group.head.number)}
          </Link>
        </td>
        <td className="px-3 py-2.5 tabular text-text-dim">
          {formatDate(group.head.visitedAt)}
        </td>
        <td className="px-3 py-2.5 text-text-dim">{group.head.measuredByName}</td>
        <td className="px-3 py-2.5"><StatusPill status={group.head.status} /></td>
        <td className="px-3 py-2.5 text-right tabular">{group.head.itemCount}</td>
        <td className="px-3 py-2.5 text-text-dim">{roomsSummary(group.head.roomsCovered)}</td>
        <td className="px-3 py-2.5 text-right tabular">
          {hasHistory ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-text hover:text-gold"
              aria-expanded={expanded}
              aria-label={`Toggle history (${group.history.length} revisions)`}
            >
              <History size={11} />
              <span className="tabular">v{group.head.revision}</span>
              <ChevronRight
                size={11}
                className={`transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="text-text-dim tabular">v{group.head.revision}</span>
          )}
        </td>
      </tr>
      {expanded &&
        group.history.map((h) => (
          <tr key={h.id} className="border-t border-rule bg-surface-2/50">
            <td className="px-3 py-2 pl-8">
              <Link
                href={`/projects/${projectId}/measurements/${h.id}` as Route}
                className="tabular text-[11.5px] text-text-dim hover:text-text"
              >
                {shortNumber(h.number)}
              </Link>
            </td>
            <td className="px-3 py-2 tabular text-[11.5px] text-text-dim">{formatDate(h.visitedAt)}</td>
            <td className="px-3 py-2 text-[11.5px] text-text-dim">{h.measuredByName}</td>
            <td className="px-3 py-2"><StatusPill status={h.status} muted /></td>
            <td className="px-3 py-2 text-right tabular text-[11.5px] text-text-dim">{h.itemCount}</td>
            <td className="px-3 py-2 text-[11.5px] text-text-dim">{roomsSummary(h.roomsCovered)}</td>
            <td className="px-3 py-2 text-right tabular text-[11.5px] text-text-dim">v{h.revision}</td>
          </tr>
        ))}
    </>
  );
}

function shortNumber(n: string): string {
  const parts = n.split("/");
  return parts.length >= 2 ? parts.slice(-1)[0] ?? n : n;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(d);
}

function roomsSummary(rooms: string[]): string {
  if (rooms.length === 0) return "—";
  if (rooms.length <= 3) return rooms.join(" · ");
  return `${rooms.slice(0, 2).join(" · ")} +${rooms.length - 2}`;
}
