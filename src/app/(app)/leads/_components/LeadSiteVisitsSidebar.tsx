import { Calendar, Clock, MapPin } from "lucide-react";
import type { SiteVisitRow } from "@/modules/site-visits/queries";

const STATUS_TONE: Record<string, string> = {
  SCHEDULED:   "bg-info/15 text-info",
  IN_PROGRESS: "bg-heat/15 text-heat",
  COMPLETED:   "bg-solid/12 text-solid",
  CANCELLED:   "bg-fault/12 text-fault",
  RESCHEDULED: "bg-heat/15 text-heat",
  NO_SHOW:     "bg-fault/12 text-fault",
};

interface Props {
  visits: SiteVisitRow[];
  onSchedule?: () => void; // client-side trigger — unused in server render but useful for wiring
}

export function LeadSiteVisitsSidebar({ visits }: Props) {
  if (visits.length === 0) return null;

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-rule">
        <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          <MapPin size={11} />
          Site Visits
          <span className="ml-0.5 tabular text-[10px] text-text-faint">({visits.length})</span>
        </div>
      </div>

      <ul className="divide-y divide-rule">
        {visits.map((v) => {
          const tone = STATUS_TONE[v.status] ?? "bg-text-dim/12 text-text-dim";
          const statusLabel =
            v.status.charAt(0) + v.status.slice(1).toLowerCase().replace(/_/g, " ");
          const dateStr = v.scheduledAt.toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
          });
          const timeStr = v.scheduledAt.toLocaleTimeString("en-IN", {
            hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
          });

          return (
            <li key={v.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-text">{v.purpose}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-dim tabular">
                    <Calendar size={10} />
                    {dateStr}
                    <Clock size={10} className="ml-1" />
                    {timeStr}
                  </div>
                  <div className="text-[11px] text-text-faint mt-0.5">{v.assignedTo}</div>
                </div>
                <span
                  className={
                    `shrink-0 inline-block text-[10px] font-medium uppercase ` +
                    `tracking-[0.05em] px-2 py-0.5 rounded-[3px] ${tone}`
                  }
                >
                  {statusLabel}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
