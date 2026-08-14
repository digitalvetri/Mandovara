"use client";

import type { InstallEventRow } from "@/modules/install/detail-queries";

const DOT_COLORS: Record<string, string> = {
  STATUS_CHANGE:  "bg-text-muted",
  SNAG_RAISED:    "bg-fault",
  SNAG_RESOLVED:  "bg-solid",
  NOTE:           "bg-info",
};

function eventLabel(e: InstallEventRow): string {
  switch (e.type) {
    case "STATUS_CHANGE":
      if (e.fromStatus && e.toStatus) return `${e.fromStatus} → ${e.toStatus}`;
      if (e.toStatus) return `Created as ${e.toStatus}`;
      return "Status changed";
    case "SNAG_RAISED": {
      const desc = (e.payload.description as string | undefined) ?? "";
      return `Snag raised${desc ? `: ${desc.slice(0, 60)}${desc.length > 60 ? "…" : ""}` : ""}`;
    }
    case "SNAG_RESOLVED": {
      const note = (e.payload.resolutionNote as string | undefined) ?? "";
      return `Snag resolved${note ? `: ${note.slice(0, 60)}` : ""}`;
    }
    default:
      return e.type;
  }
}

export function ActivityTimeline({ events }: { events: InstallEventRow[] }) {
  if (events.length === 0) return null;

  const sorted = [...events].reverse();

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-[13px] font-semibold text-text">Activity</h2>
      </div>
      <div className="px-4 py-3 space-y-3">
        {sorted.map((e) => (
          <div key={e.id} className="flex items-start gap-3">
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[e.type] ?? "bg-text-subtle"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-text leading-snug">{eventLabel(e)}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {e.actorName} · {new Date(e.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
