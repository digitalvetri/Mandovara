import { notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { getInstallVisit } from "@/modules/install/queries";
import { INSTALL_STATUS_LABELS } from "@/modules/install/schema";
import { Wrench, Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  const base = "inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full";
  switch (status) {
    case "SCHEDULED": return `${base} bg-info/15 text-info`;
    case "IN_PROGRESS": return `${base} bg-heat/15 text-heat`;
    case "COMPLETED": return `${base} bg-solid/15 text-solid`;
    default: return `${base} bg-surface-2 text-text-muted`;
  }
}

export default async function InstallVisitPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const ctx = await devContext();
  const visit = await getInstallVisit(ctx, visitId);
  if (!visit) notFound();

  const completedLines = visit.lines.filter(
    (l) => parseFloat(l.installedQty) > 0,
  ).length;

  return (
    <div className="py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={16} className="text-gold" strokeWidth={1.5} />
            <span className="font-data text-[13px] text-text-muted">{visit.number}</span>
            <span className={statusBadge(visit.status)}>
              {INSTALL_STATUS_LABELS[visit.status] ?? visit.status}
            </span>
          </div>
          <h1 className="text-[20px] font-display font-semibold text-text">{visit.projectName}</h1>
          <p className="text-[13px] text-text-muted">{visit.clientName} · {visit.clientMobile}</p>
          <p className="text-[12px] text-text-subtle mt-0.5">Order {visit.orderNumber}</p>
        </div>
        <a
          href={`/m/install/${visit.id}`}
          className="flex items-center gap-2 h-9 px-4 rounded-md bg-gold text-ink text-[12px] font-semibold hover:bg-gold-strong transition-colors"
        >
          <Smartphone size={14} strokeWidth={2} />
          Open on Mobile
        </a>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Scheduled</div>
          <div className="text-[16px] font-data font-semibold text-text">
            {new Date(visit.scheduledAt).toLocaleDateString("en-IN", {
              day: "2-digit", month: "short", year: "numeric",
            })}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Crew</div>
          <div className="text-[15px] font-medium text-text">{visit.crewName ?? "Unassigned"}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Progress</div>
          <div className="text-[16px] font-data font-semibold text-text">
            {completedLines} / {visit.lines.length} lines
          </div>
        </div>
      </div>

      {/* Install lines */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-text">Room-by-Room Install Lines</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 text-text-muted font-medium">Room</th>
                <th className="px-4 py-2.5 text-text-muted font-medium">Item</th>
                <th className="px-4 py-2.5 text-text-muted font-medium text-right">Planned</th>
                <th className="px-4 py-2.5 text-text-muted font-medium text-right">Installed</th>
                <th className="px-4 py-2.5 text-text-muted font-medium">Dye Lot</th>
                <th className="px-4 py-2.5 text-text-muted font-medium">Issue</th>
              </tr>
            </thead>
            <tbody>
              {visit.lines.map((line, i) => {
                const installed = parseFloat(line.installedQty);
                const planned = parseFloat(line.plannedQty);
                const done = installed >= planned && planned > 0;
                return (
                  <tr
                    key={line.id}
                    className={`border-b border-border/50 ${i === visit.lines.length - 1 ? "border-b-0" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-text">{line.roomLabel}</td>
                    <td className="px-4 py-3">
                      <div className="text-text truncate max-w-[180px]">{line.description}</div>
                      {line.colourName && (
                        <div className="text-[10px] text-text-muted font-data">{line.colourwayCode}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-data text-text-muted">{parseFloat(line.plannedQty).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-data">
                      <span className={done ? "text-solid font-medium" : "text-text"}>
                        {installed > 0 ? installed.toFixed(2) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-data text-[11px] text-text-muted">{line.dyeLotUsed ?? "—"}</td>
                    <td className="px-4 py-3 text-text-muted">{line.issue ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature */}
      {visit.clientSignatureKey && (
        <div className="mt-4 bg-surface border border-border rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Client Signature</div>
          <div className="text-[12px] text-solid">✓ Signature captured</div>
          {visit.completedAt && (
            <div className="text-[11px] text-text-muted mt-1">
              Completed {new Date(visit.completedAt).toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {visit.notes && (
        <div className="mt-4 bg-surface border border-border rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Notes</div>
          <p className="text-[13px] text-text">{visit.notes}</p>
        </div>
      )}
    </div>
  );
}
