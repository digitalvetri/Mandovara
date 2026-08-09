import { devContext } from "@/lib/dev-context";
import { listInstallVisits } from "@/modules/install/queries";
import { INSTALL_STATUS_LABELS } from "@/modules/install/schema";
import { Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  const base = "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full";
  switch (status) {
    case "SCHEDULED": return `${base} bg-info/15 text-info`;
    case "IN_PROGRESS": return `${base} bg-heat/15 text-heat`;
    case "COMPLETED": return `${base} bg-solid/15 text-solid`;
    case "PARTIAL": return `${base} bg-heat/15 text-heat`;
    case "RESCHEDULED": return `${base} bg-gold-tint text-gold`;
    case "CANCELLED": return `${base} bg-surface-2 text-text-muted`;
    default: return `${base} bg-surface-2 text-text-muted`;
  }
}

export default async function InstallPage() {
  const ctx = await devContext();
  const visits = await listInstallVisits(ctx);

  const upcoming = visits.filter((v) => v.status === "SCHEDULED" || v.status === "RESCHEDULED");
  const active = visits.filter((v) => v.status === "IN_PROGRESS");
  const done = visits.filter((v) => v.status === "COMPLETED" || v.status === "CANCELLED");

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Wrench size={22} className="text-gold" strokeWidth={1.5} />
        <div>
          <h1 className="text-[22px] font-display font-semibold text-text leading-none">
            Installation
          </h1>
          <p className="text-[12px] text-text-muted mt-0.5">
            {active.length} in progress · {upcoming.length} scheduled
          </p>
        </div>
      </div>

      {visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wrench size={40} className="text-text-subtle mb-3" strokeWidth={1.2} />
          <p className="text-[14px] text-text-muted">No install visits yet</p>
          <p className="text-[12px] text-text-subtle mt-1">Create an install visit from a confirmed order</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <Section title="In Progress" visits={active} />
          )}
          {upcoming.length > 0 && (
            <Section title="Scheduled" visits={upcoming} />
          )}
          {done.length > 0 && (
            <Section title="Completed" visits={done} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, visits }: { title: string; visits: Awaited<ReturnType<typeof listInstallVisits>> }) {
  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-widest text-text-muted mb-3 font-semibold">
        {title}
      </h2>
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2.5 text-text-muted font-medium">Visit</th>
              <th className="px-4 py-2.5 text-text-muted font-medium">Project</th>
              <th className="px-4 py-2.5 text-text-muted font-medium">Client</th>
              <th className="px-4 py-2.5 text-text-muted font-medium">Date</th>
              <th className="px-4 py-2.5 text-text-muted font-medium">Crew</th>
              <th className="px-4 py-2.5 text-text-muted font-medium text-right">Lines</th>
              <th className="px-4 py-2.5 text-text-muted font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((v, i) => (
              <tr
                key={v.id}
                className={`border-b border-border/50 hover:bg-surface-2/40 transition-colors ${
                  i === visits.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <a href={`/install/${v.id}`} className="font-data text-[11px] text-gold hover:underline">
                    {v.number}
                  </a>
                </td>
                <td className="px-4 py-3 text-text">{v.projectName}</td>
                <td className="px-4 py-3 text-text-muted">{v.clientName}</td>
                <td className="px-4 py-3 font-data text-text-muted">
                  {new Date(v.scheduledAt).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-text-muted">{v.crewName ?? "—"}</td>
                <td className="px-4 py-3 text-right font-data text-text-muted">{v.lineCount}</td>
                <td className="px-4 py-3">
                  <span className={statusBadge(v.status)}>{INSTALL_STATUS_LABELS[v.status] ?? v.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
