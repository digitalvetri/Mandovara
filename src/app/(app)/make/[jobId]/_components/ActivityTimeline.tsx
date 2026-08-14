import type { MakeJobEventRow } from "@/modules/make/queries";
import { MAKE_STATUS_LABELS } from "@/modules/make/schema";

function eventLabel(e: MakeJobEventRow): { title: string; detail: string | null } {
  switch (e.type) {
    case "STATUS_CHANGE": {
      const from = e.fromStatus ? (MAKE_STATUS_LABELS[e.fromStatus] ?? e.fromStatus) : null;
      const to = e.toStatus ? (MAKE_STATUS_LABELS[e.toStatus] ?? e.toStatus) : "Queued";
      return {
        title: from ? `Moved from ${from} → ${to}` : `Created · ${to}`,
        detail: null,
      };
    }
    case "QC_PASS":
      return { title: "QC Passed → Ready", detail: null };
    case "QC_FAIL": {
      const p = e.payload;
      const defects = typeof p.defects === "string" ? p.defects : null;
      const rework = typeof p.reworkNotes === "string" ? p.reworkNotes : null;
      return {
        title: "QC Failed → Rework",
        detail: [defects, rework].filter(Boolean).join(" · ") || null,
      };
    }
    case "FABRIC_ISSUED": {
      const p = e.payload;
      const qty = typeof p.fabricIssuedM === "number" ? `${p.fabricIssuedM.toFixed(3)} m` : "";
      return { title: `Fabric issued${qty ? `: ${qty}` : ""}`, detail: null };
    }
    default:
      return { title: e.type, detail: null };
  }
}

function dotColor(type: string): string {
  switch (type) {
    case "QC_PASS":    return "bg-solid";
    case "QC_FAIL":    return "bg-fault";
    case "FABRIC_ISSUED": return "bg-info";
    default:           return "bg-text-muted";
  }
}

export function ActivityTimeline({ events }: { events: MakeJobEventRow[] }) {
  if (events.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-3">
        Activity
      </p>
      <ol className="relative border-l border-border ml-2 space-y-3">
        {[...events].reverse().map((e) => {
          const { title, detail } = eventLabel(e);
          return (
            <li key={e.id} className="pl-4">
              <span
                className={`absolute -left-[5px] mt-[5px] h-2.5 w-2.5 rounded-full border-2 border-surface ${dotColor(e.type)}`}
              />
              <p className="text-[12px] text-text font-medium leading-snug">{title}</p>
              {detail && (
                <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{detail}</p>
              )}
              <p className="text-[10.5px] text-text-subtle mt-0.5 font-data">
                {e.actorName} ·{" "}
                {new Date(e.createdAt).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
