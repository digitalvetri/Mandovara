import Link from "next/link";
import type { Route } from "next";
import { Eye } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listSiteVisits } from "@/modules/site-visits/queries";
import { listProjectsForSelect } from "@/modules/projects/queries";
import { formatDate } from "@/kernel/datetime";
import { NewVisitButton } from "./_components/NewVisitButton";

export const dynamic = "force-dynamic";

const STATUS_STRIP: Record<string, string> = {
  SCHEDULED:   "bg-info",
  IN_PROGRESS: "bg-heat",
  COMPLETED:   "bg-solid",
  CANCELLED:   "bg-border",
  RESCHEDULED: "bg-heat",
};

const STATUS_PILL: Record<string, string> = {
  SCHEDULED:   "bg-info/10 text-info",
  IN_PROGRESS: "bg-heat/10 text-heat",
  COMPLETED:   "bg-solid/10 text-solid",
  CANCELLED:   "bg-surface-2 text-text-dim",
  RESCHEDULED: "bg-heat/10 text-heat",
};

export default async function SiteVisitsPage() {
  const ctx = await devContext();
  const [visits, projects] = await Promise.all([
    listSiteVisits(ctx, { limit: 100 }),
    listProjectsForSelect(ctx),
  ]);

  const th  = "px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim";

  return (
    <>
      <Topbar
        title="Site Visits"
        eyebrow="Scheduled field visits — surveys, measurements, supervision and handovers"
        actions={<NewVisitButton projects={projects} />}
      />

      <div className="overflow-hidden rounded-[12px] border border-rule bg-surface">
        {visits.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-[13px] font-medium text-text mb-1.5">No site visits yet.</div>
            <div className="text-[11.5px] text-text-dim mt-1">Schedule the first visit using the button above.</div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-rule">
                <th className="w-[5px] p-0" aria-hidden />
                <th className={th}>Number</th>
                <th className={th}>Purpose</th>
                <th className={th}>Status</th>
                <th className={th}>Assigned To</th>
                <th className={`${th} hidden md:table-cell`}>Project / Client</th>
                <th className={`${th} hidden lg:table-cell`}>Observations</th>
                <th className="px-4 py-3 w-[60px]" />
              </tr>
            </thead>
            <tbody>
              {visits.map((v, i) => {
                const strip = STATUS_STRIP[v.status] ?? "bg-border";
                const pill  = STATUS_PILL[v.status]  ?? "bg-surface-2 text-text-dim";
                return (
                  <tr
                    key={v.id}
                    className={[
                      "group relative transition-colors hover:bg-surface-2/60 cursor-pointer",
                      i > 0 ? "border-t border-rule" : "",
                    ].join(" ")}
                  >
                    {/* accent strip */}
                    <td className="p-0 w-[5px]">
                      <div className={`h-full w-[5px] min-h-[64px] ${strip}`} />
                    </td>

                    {/* number + date */}
                    <td className="px-4 py-4">
                      <Link
                        href={`/site-visits/${v.id}` as Route}
                        className="block tabular text-[13px] font-semibold text-accent hover:underline"
                                              >
                        {v.number.split("/").pop() ?? v.number}
                      </Link>
                      <div className="tabular text-[11px] text-text-faint mt-0.5">
                        {formatDate(v.scheduledAt)}
                      </div>
                    </td>

                    {/* purpose */}
                    <td className="px-4 py-4">
                      <span className="text-[13px] text-text">{v.purpose}</span>
                    </td>

                    {/* status pill */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${pill}`}>
                        {v.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* assigned to */}
                    <td className="px-4 py-4">
                      <span className="text-[13px] text-text-dim">{v.assignedTo ?? "—"}</span>
                    </td>

                    {/* project / client */}
                    <td className="px-4 py-4 hidden md:table-cell max-w-[200px]">
                      {v.projectName && (
                        <div className="text-[13px] font-medium text-text leading-snug truncate">
                          {v.projectName}
                        </div>
                      )}
                      {v.clientName && (
                        <div className="text-[11px] text-text-dim mt-0.5 truncate">
                          {v.clientName}
                        </div>
                      )}
                      {!v.projectName && !v.clientName && (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>

                    {/* observations */}
                    <td className="px-4 py-4 hidden lg:table-cell max-w-[220px]">
                      <span className="text-[12px] text-text-dim truncate block">
                        {v.observations ?? "—"}
                      </span>
                    </td>

                    {/* actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end">
                        <Link
                          href={`/site-visits/${v.id}` as Route}
                          title="View visit"
                                                    className="flex items-center justify-center w-7 h-7 rounded-[6px] text-text-dim hover:text-text hover:bg-surface-2 transition-colors"
                        >
                          <Eye size={14} strokeWidth={1.75} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
