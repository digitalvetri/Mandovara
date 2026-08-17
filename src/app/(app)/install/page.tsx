import Link from "next/link";
import { devContext } from "@/lib/dev-context";
import {
  listInstallVisits, getInstallStatusCounts, listOpenSnags,
  type InstallVisitRow, type SnagListRow,
} from "@/modules/install/queries";
import { INSTALL_STATUS_LABELS, INSTALL_STATUS_COLORS } from "@/modules/install/schema";
import { RouteView } from "./_components/RouteView";
import { SnagRegister } from "./_components/SnagRegister";
import { Wrench, Plus, AlertTriangle, CalendarDays, List } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { key: "SCHEDULED",          label: "Scheduled" },
  { key: "ASSIGNED",           label: "Assigned" },
  { key: "IN_PROGRESS",        label: "In Progress" },
  { key: "COMPLETED",          label: "Completed" },
  { key: "SNAGGING",           label: "Snagging" },
  { key: "CUSTOMER_CONFIRMED", label: "Confirmed" },
  { key: "CLOSED",             label: "Closed" },
] as const;

type TabKey = (typeof STATUS_TABS)[number]["key"];
type View   = "list" | "route" | "snags";

interface SearchParams { status?: string; view?: string }

export default async function InstallPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status: rawStatus, view: rawView } = await searchParams;

  const view: View  = (["list", "route", "snags"].includes(rawView ?? "") ? rawView : "list") as View;
  const activeTab   = (STATUS_TABS.find((t) => t.key === rawStatus)?.key ?? "SCHEDULED") as TabKey;

  const ctx    = await devContext();
  const counts = await getInstallStatusCounts(ctx);

  let visits: InstallVisitRow[] = [];
  let snags: SnagListRow[]      = [];

  if (view === "route") {
    const now      = new Date();
    const routeEnd = new Date(now.getTime() + 21 * 86_400_000);
    visits = await listInstallVisits(ctx, {
      status: ["SCHEDULED", "ASSIGNED", "IN_PROGRESS"] as TabKey[],
      dateFrom: now,
      dateTo: routeEnd,
    });
  } else if (view === "snags") {
    snags = await listOpenSnags(ctx);
  } else {
    visits = await listInstallVisits(ctx, { status: [activeTab] });
  }

  const siteAddr = (addr: unknown): string => {
    if (!addr || typeof addr !== "object") return "—";
    const a = addr as Record<string, string>;
    return [a.line, a.city].filter(Boolean).join(", ") || "—";
  };

  return (
    <div className="py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench size={22} className="text-gold" strokeWidth={1.5} />
          <div>
            <h1 className="text-[22px] font-display font-semibold text-text leading-none">
              Installation
            </h1>
            <p className="text-[12px] text-text-muted mt-0.5">
              {counts.IN_PROGRESS} in progress ·{" "}
              {counts.SCHEDULED + counts.ASSIGNED} upcoming
              {counts.SNAGGING > 0 && (
                <span className="text-fault"> · {counts.SNAGGING} snagging</span>
              )}
            </p>
          </div>
        </div>
        <Link
          href="/install/new"
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-gold text-ink text-[12px] font-semibold hover:bg-gold-strong transition-colors"
        >
          <Plus size={13} />
          New Visit
        </Link>
      </div>

      {/* Tabs row + view switcher */}
      <div className="flex items-end justify-between border-b border-border">
        {/* Left: status tabs (list) or view label (route/snags) */}
        <div className="flex gap-0 overflow-x-auto">
          {view === "list" && STATUS_TABS.map((tab) => {
            const cnt    = counts[tab.key] ?? 0;
            const active = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                href={`/install?view=list&status=${tab.key}`}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  active
                    ? "border-gold text-gold"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {tab.label}
                {cnt > 0 && (
                  <span
                    className={`font-data text-[10px] px-1.5 py-0.5 rounded-full ${
                      active ? "bg-gold/20 text-gold" : "bg-surface-2 text-text-subtle"
                    }`}
                  >
                    {cnt}
                  </span>
                )}
              </Link>
            );
          })}

          {view === "route" && (
            <span className="px-3 py-2 text-[12px] font-medium text-gold border-b-2 border-gold -mb-px whitespace-nowrap">
              Next 21 days
            </span>
          )}

          {view === "snags" && (
            <span className="px-3 py-2 text-[12px] font-medium text-fault border-b-2 border-fault -mb-px flex items-center gap-1.5 whitespace-nowrap">
              <AlertTriangle size={12} />
              Open Snags
            </span>
          )}
        </div>

        {/* Right: view switcher pills */}
        <div className="flex items-center gap-1 pb-2 shrink-0 ml-4">
          <ViewPill href="/install?view=list"  label="List"  active={view === "list"}  Icon={List} />
          <ViewPill href="/install?view=route" label="Route" active={view === "route"} Icon={CalendarDays} />
          <ViewPill
            href="/install?view=snags"
            label="Snags"
            active={view === "snags"}
            Icon={AlertTriangle}
            badge={counts.SNAGGING > 0 ? counts.SNAGGING : undefined}
          />
        </div>
      </div>

      {/* Content */}
      {view === "route" ? (
        <RouteView visits={visits} />
      ) : view === "snags" ? (
        <SnagRegister snags={snags} />
      ) : (
        visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Wrench size={40} className="text-text-subtle mb-3" strokeWidth={1.2} />
            <p className="text-[14px] text-text-muted">
              No {INSTALL_STATUS_LABELS[activeTab]?.toLowerCase()} visits
            </p>
            {activeTab === "SCHEDULED" && (
              <Link href="/install/new" className="mt-3 text-[12px] text-gold hover:underline">
                Create an installation visit →
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2.5 text-text-muted font-medium">Visit</th>
                  <th className="px-4 py-2.5 text-text-muted font-medium">Order</th>
                  <th className="px-4 py-2.5 text-text-muted font-medium">Client / Project</th>
                  <th className="px-4 py-2.5 text-text-muted font-medium hidden md:table-cell">Site</th>
                  <th className="px-4 py-2.5 text-text-muted font-medium">Date</th>
                  <th className="px-4 py-2.5 text-text-muted font-medium">Crew</th>
                  <th className="px-4 py-2.5 text-text-muted font-medium text-center">Lines</th>
                  <th className="px-4 py-2.5 text-text-muted font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v, i) => (
                  <tr
                    key={v.id}
                    className={`hover:bg-surface-2/40 transition-colors ${
                      i < visits.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/install/${v.id}`}
                        className="font-data text-[11px] text-gold hover:underline"
                      >
                        {v.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-data text-[11px] text-text-muted">
                      {v.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-text">{v.clientName}</span>
                      <span className="block text-[11px] text-text-muted">{v.projectName}</span>
                    </td>
                    <td className="px-4 py-3 text-text-muted max-w-[180px] truncate hidden md:table-cell">
                      {siteAddr(v.siteAddress)}
                    </td>
                    <td className="px-4 py-3 font-data text-text-muted">
                      {new Date(v.scheduledAt).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short",
                        timeZone: "Asia/Kolkata",
                      })}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {v.crewName ?? <span className="text-text-subtle">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-data text-text-muted">
                      {v.lineCount}
                      {v.snagCount > 0 && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-fault text-[10px]">
                          <AlertTriangle size={10} /> {v.snagCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          INSTALL_STATUS_COLORS[v.status] ?? ""
                        }`}
                      >
                        {INSTALL_STATUS_LABELS[v.status] ?? v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function ViewPill({
  href,
  label,
  active,
  Icon,
  badge,
}: {
  href: string;
  label: string;
  active: boolean;
  Icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] text-[11px] font-medium transition-colors ${
        active
          ? "bg-gold/15 text-gold border border-gold/30"
          : "text-text-muted hover:text-text hover:bg-surface-2"
      }`}
    >
      <Icon size={12} strokeWidth={1.7} />
      {label}
      {badge != null && (
        <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-fault text-white text-[9px] font-bold flex items-center justify-center leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}
