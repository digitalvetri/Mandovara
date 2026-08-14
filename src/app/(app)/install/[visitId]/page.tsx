import Link from "next/link";
import { notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { getInstallVisit } from "@/modules/install/detail-queries";
import { INSTALL_STATUS_LABELS, INSTALL_STATUS_COLORS, INSTALL_KANBAN_COLUMNS } from "@/modules/install/schema";
import { listInstallCrews } from "@/modules/install/queries";
import { Wrench, Smartphone, ChevronLeft, AlertTriangle, CheckCircle } from "lucide-react";
import { StatusActions } from "./_components/StatusActions";
import { SnagPanel } from "./_components/SnagPanel";
import { ActivityTimeline } from "./_components/ActivityTimeline";

export const dynamic = "force-dynamic";

export default async function InstallVisitPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const ctx     = await devContext();
  const [visit, crews] = await Promise.all([
    getInstallVisit(ctx, visitId),
    listInstallCrews(ctx),
  ]);
  if (!visit) notFound();

  const completedLines = visit.lines.filter((l) => parseFloat(l.installedQty) >= parseFloat(l.plannedQty) && parseFloat(l.plannedQty) > 0).length;
  const openSnags = visit.snags.filter((s) => s.status === "OPEN" || s.status === "IN_PROGRESS").length;
  const siteAddrStr = (() => {
    if (!visit.siteAddress) return null;
    const a = visit.siteAddress as Record<string, string>;
    return [a.line, a.city, a.pincode].filter(Boolean).join(", ") || null;
  })();

  const stageOrder: typeof INSTALL_KANBAN_COLUMNS[number][] = ["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED"];
  const currentIdx = stageOrder.indexOf(visit.status as (typeof stageOrder)[number]);

  return (
    <div className="py-6 max-w-5xl space-y-5">
      {/* Breadcrumb */}
      <Link href="/install" className="flex items-center gap-1 text-[11px] text-text-muted hover:text-gold transition-colors">
        <ChevronLeft size={13} /> All Visits
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={15} className="text-gold" strokeWidth={1.5} />
            <span className="font-data text-[13px] text-text-muted">{visit.number}</span>
            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${INSTALL_STATUS_COLORS[visit.status] ?? ""}`}>
              {INSTALL_STATUS_LABELS[visit.status] ?? visit.status}
            </span>
            {openSnags > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-fault font-semibold">
                <AlertTriangle size={11} /> {openSnags} open snag{openSnags > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <h1 className="text-[20px] font-display font-semibold text-text">{visit.projectName}</h1>
          <p className="text-[13px] text-text-muted">{visit.clientName} · {visit.clientMobile}</p>
          {siteAddrStr && <p className="text-[11px] text-text-subtle mt-0.5">{siteAddrStr}</p>}
          <p className="text-[11px] text-text-subtle mt-0.5">
            Order <Link href={`/orders/${visit.orderId}`} className="text-gold hover:underline font-data">{visit.orderNumber}</Link>
            {visit.crewName && <span> · {visit.crewName}</span>}
          </p>
        </div>
        <Link
          href={`/m/install/${visit.id}`}
          className="flex items-center gap-2 h-9 px-4 rounded-md bg-gold text-ink text-[12px] font-semibold hover:bg-gold-strong transition-colors"
        >
          <Smartphone size={14} strokeWidth={2} /> Open on Mobile
        </Link>
      </div>

      {/* Stage stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stageOrder.map((stage, idx) => {
          const done    = idx < currentIdx;
          const current = idx === currentIdx;
          const isSnagging = visit.status === "SNAGGING" && stage === "COMPLETED";
          return (
            <div key={stage} className="flex items-center gap-1 shrink-0">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                isSnagging ? "bg-fault/15 text-fault border border-fault/30" :
                current ? "bg-gold/20 text-gold border border-gold/40" :
                done ? "bg-solid/15 text-solid border border-solid/30" :
                "bg-surface-2 text-text-subtle border border-border"
              }`}>
                {done && <CheckCircle size={11} />}
                {INSTALL_STATUS_LABELS[stage] ?? stage}
              </div>
              {idx < stageOrder.length - 1 && <div className={`w-4 h-px ${done ? "bg-solid/40" : "bg-border"}`} />}
            </div>
          );
        })}
        {visit.status === "SNAGGING" && (
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-4 h-px bg-fault/40" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-fault/15 text-fault border border-fault/30">
              <AlertTriangle size={11} /> Snagging
            </div>
          </div>
        )}
      </div>

      {/* Key dates strip */}
      <div className="flex gap-4 text-[11px] text-text-muted">
        <span>Scheduled: <span className="font-data text-text">{new Date(visit.scheduledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></span>
        {visit.startedAt && <span>Started: <span className="font-data text-text">{new Date(visit.startedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span></span>}
        {visit.completedAt && <span>Completed: <span className="font-data text-text">{new Date(visit.completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span></span>}
        {visit.customerConfirmedAt && <span>Confirmed: <span className="font-data text-solid">{new Date(visit.customerConfirmedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span></span>}
      </div>

      {/* Status actions */}
      <StatusActions
        visitId={visit.id}
        projectId={visit.projectId}
        status={visit.status}
        openSnags={openSnags}
        crews={crews}
        currentCrewId={visit.crewName ? undefined : undefined}
      />

      {/* Install lines */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-text">Items to Install</h2>
          <span className="text-[11px] text-text-muted font-data">{completedLines}/{visit.lines.length} done</span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2 text-text-muted font-medium">Room</th>
              <th className="px-4 py-2 text-text-muted font-medium">Item</th>
              <th className="px-4 py-2 text-text-muted font-medium text-right">Planned</th>
              <th className="px-4 py-2 text-text-muted font-medium text-right">Installed</th>
              <th className="px-4 py-2 text-text-muted font-medium">Dye Lot</th>
              <th className="px-4 py-2 text-text-muted font-medium">Issue</th>
            </tr>
          </thead>
          <tbody>
            {visit.lines.map((line, i) => {
              const installed = parseFloat(line.installedQty);
              const planned   = parseFloat(line.plannedQty);
              const done      = installed >= planned && planned > 0;
              return (
                <tr key={line.id} className={`${i < visit.lines.length - 1 ? "border-b border-border/50" : ""}`}>
                  <td className="px-4 py-3 text-text font-medium">{line.roomLabel}</td>
                  <td className="px-4 py-3 text-text">{line.description}</td>
                  <td className="px-4 py-3 text-right font-data text-text-muted">{planned.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-data">
                    <span className={done ? "text-solid font-semibold" : "text-text"}>{installed > 0 ? installed.toFixed(2) : "—"}</span>
                  </td>
                  <td className="px-4 py-3 font-data text-[11px] text-text-muted">{line.dyeLotUsed ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{line.issue ? <span className="text-fault">{line.issue}</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Snags */}
      <SnagPanel visitId={visit.id} projectId={visit.projectId} snags={visit.snags} status={visit.status} />

      {/* Notes */}
      {visit.notes && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Notes</p>
          <p className="text-[13px] text-text">{visit.notes}</p>
        </div>
      )}

      {/* Activity */}
      <ActivityTimeline events={visit.events} />
    </div>
  );
}
