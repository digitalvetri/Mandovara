import Link from "next/link";
import type { Route } from "next";
import { MapPin, Clock, Users } from "lucide-react";
import type { InstallVisitRow } from "@/modules/install/queries";
import { INSTALL_STATUS_LABELS, INSTALL_STATUS_COLORS } from "@/modules/install/schema";

interface Props {
  visits: InstallVisitRow[];
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
    hour12: true, timeZone: "Asia/Kolkata",
  });
}

function fmtDay(d: Date): string {
  return new Date(d).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "Asia/Kolkata",
  });
}

function dateKey(d: Date): string {
  const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(ist.getDate()).padStart(2, "0")}`;
}

function siteAddrShort(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as Record<string, string>;
  return [a.line, a.city].filter(Boolean).join(", ") || "—";
}

export function RouteView({ visits }: Props) {
  if (visits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <MapPin size={40} className="text-text-subtle mb-3" strokeWidth={1.2} />
        <p className="text-[14px] text-text-muted">No visits scheduled in the next 21 days</p>
      </div>
    );
  }

  // Group by date-key, then within each day by crewName
  const byDay = new Map<string, { date: Date; byCrew: Map<string, InstallVisitRow[]> }>();
  for (const v of visits) {
    const key = dateKey(new Date(v.scheduledAt));
    if (!byDay.has(key)) {
      byDay.set(key, { date: new Date(v.scheduledAt), byCrew: new Map() });
    }
    const day = byDay.get(key)!;
    const crewKey = v.crewName ?? "__unassigned__";
    if (!day.byCrew.has(crewKey)) day.byCrew.set(crewKey, []);
    day.byCrew.get(crewKey)!.push(v);
  }

  const sortedDays = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      {sortedDays.map(([dayKey, { date, byCrew }]) => {
        const isToday = dayKey === dateKey(new Date());
        return (
          <div key={dayKey}>
            <div className={`flex items-center gap-3 mb-3 px-1 ${isToday ? "text-gold" : "text-text-muted"}`}>
              <div className={`h-px flex-1 ${isToday ? "bg-gold/30" : "bg-border"}`} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                {isToday ? "Today · " : ""}{fmtDay(date)}
              </span>
              <div className={`h-px flex-1 ${isToday ? "bg-gold/30" : "bg-border"}`} />
            </div>

            <div className="space-y-3">
              {[...byCrew.entries()].map(([crew, crewVisits]) => (
                <div key={crew} className="bg-surface border border-border rounded-lg overflow-hidden">
                  {/* Crew header */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-surface-2/60 border-b border-border/60">
                    <Users size={13} className="text-text-muted" strokeWidth={1.6} />
                    <span className="text-[11.5px] font-semibold text-text">
                      {crew === "__unassigned__" ? (
                        <span className="text-heat">Unassigned</span>
                      ) : crew}
                    </span>
                    <span className="ml-auto text-[10px] text-text-subtle">
                      {crewVisits.length} visit{crewVisits.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Visit rows */}
                  <div className="divide-y divide-border/50">
                    {crewVisits.map((v) => (
                      <Link
                        key={v.id}
                        href={`/install/${v.id}` as Route}
                        className="flex items-start gap-4 px-4 py-3 hover:bg-surface-2/40 transition-colors"
                      >
                        {/* Time */}
                        <div className="flex items-center gap-1 text-[11px] text-text-subtle font-data min-w-[70px] mt-0.5">
                          <Clock size={11} />
                          {fmtTime(new Date(v.scheduledAt))}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-data text-[10.5px] text-text-muted">{v.number}</span>
                            <span className="text-[12.5px] font-medium text-text truncate">{v.clientName}</span>
                          </div>
                          <div className="text-[11px] text-text-muted truncate mt-0.5">{v.projectName}</div>
                          <div className="flex items-center gap-1 mt-1 text-[10.5px] text-text-subtle">
                            <MapPin size={10} />
                            <span className="truncate">{siteAddrShort(v.siteAddress)}</span>
                          </div>
                        </div>

                        {/* Status */}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${INSTALL_STATUS_COLORS[v.status] ?? ""}`}>
                          {INSTALL_STATUS_LABELS[v.status] ?? v.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
