import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listSiteVisits } from "@/modules/site-visits/queries";
import { formatDate } from "@/kernel/datetime";
import { NewVisitButton } from "./_components/NewVisitButton";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  SCHEDULED:   "bg-info/12 text-info",
  IN_PROGRESS: "bg-heat/12 text-heat",
  COMPLETED:   "bg-solid/12 text-solid",
  CANCELLED:   "bg-surface-2 text-text-dim",
  RESCHEDULED: "bg-heat/12 text-heat",
};

export default async function SiteVisitsPage() {
  const ctx = await devContext();
  const visits = await listSiteVisits(ctx, { limit: 100 });

  return (
    <>
      <Topbar
        title="Site Visits"
        eyebrow="Scheduled field visits — surveys, measurements, supervision and handovers"
        actions={<NewVisitButton />}
      />

      <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
        {visits.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-[13px] text-text-dim">No site visits yet.</div>
            <div className="text-[11.5px] text-text-faint mt-1">Schedule the first visit using the button above.</div>
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Number</Th>
                <Th>Purpose</Th>
                <Th>Scheduled</Th>
                <Th>Status</Th>
                <Th>Assigned to</Th>
                <Th>Project / Client</Th>
                <Th>Observations</Th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-rule/60 last:border-0 hover:bg-surface-2/30 transition-colors">
                  <Td>
                    <a href={`/site-visits/${v.id}`} className="font-mono text-[11.5px] text-accent hover:underline">
                      {v.number}
                    </a>
                  </Td>
                  <Td className="text-text-dim">{v.purpose}</Td>
                  <Td className="tabular text-text-dim">{formatDate(v.scheduledAt)}</Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium ${STATUS_CHIP[v.status] ?? "bg-surface-2 text-text-dim"}`}>
                      {v.status.replace(/_/g, " ")}
                    </span>
                  </Td>
                  <Td className="text-text-dim">{v.assignedTo}</Td>
                  <Td>
                    {v.projectName && <div className="text-text">{v.projectName}</div>}
                    {v.clientName  && <div className="text-[11px] text-text-dim">{v.clientName}</div>}
                  </Td>
                  <Td className="text-text-dim text-[11px] max-w-[200px] truncate">
                    {v.observations ?? "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 h-[36px] font-medium text-left whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}
