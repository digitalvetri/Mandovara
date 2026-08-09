import { notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { getMakeJob } from "@/modules/make/queries";
import { MAKE_STATUS_LABELS, MAKE_STATUS_NEXT } from "@/modules/make/schema";
import { AdvanceMakeJobButton } from "./_components/AdvanceMakeJobButton";
import { Scissors } from "lucide-react";
import { PrintButton } from "./_components/PrintButton";

export const dynamic = "force-dynamic";

function mm(val: string | null | undefined): string {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : `${n.toFixed(1)} mm`;
}

function metres(val: string | null | undefined): string {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : `${n.toFixed(3)} m`;
}

export default async function MakeJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const ctx = await devContext();
  const job = await getMakeJob(ctx, jobId);
  if (!job) notFound();

  const nextStatus = MAKE_STATUS_NEXT[job.status];

  return (
    <div className="py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scissors size={16} className="text-gold" strokeWidth={1.5} />
            <span className="font-data text-[13px] text-text-muted">{job.number}</span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
              {MAKE_STATUS_LABELS[job.status] ?? job.status}
            </span>
          </div>
          <h1 className="text-[20px] font-display font-semibold text-text">{job.projectName}</h1>
          <p className="text-[13px] text-text-muted">{job.clientName} · Order {job.orderNumber}</p>
          {job.vendorName && (
            <p className="text-[12px] text-text-subtle mt-0.5">Vendor: {job.vendorName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          {nextStatus && <AdvanceMakeJobButton jobId={job.id} nextStatus={nextStatus} />}
        </div>
      </div>

      {/* Cut list table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-text">Cut List</h2>
          <p className="text-[11px] text-text-muted">
            Panels and cut lengths derived from approved measurement — do not re-derive
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 text-text-muted font-medium">Room / Label</th>
                <th className="px-4 py-2.5 text-text-muted font-medium">Description</th>
                <th className="px-4 py-2.5 text-text-muted font-medium text-right">Panels</th>
                <th className="px-4 py-2.5 text-text-muted font-medium text-right">Cut Length</th>
                <th className="px-4 py-2.5 text-text-muted font-medium text-right">Fabric Issued</th>
                <th className="px-4 py-2.5 text-text-muted font-medium text-right">Actual Used</th>
                <th className="px-4 py-2.5 text-text-muted font-medium text-right">Wastage</th>
                <th className="px-4 py-2.5 text-text-muted font-medium text-center">QC</th>
              </tr>
            </thead>
            <tbody>
              {job.lines.map((line, i) => (
                <tr
                  key={line.id}
                  className={`border-b border-border/50 hover:bg-surface-2/40 transition-colors ${
                    i === job.lines.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="text-text font-medium">{line.roomLabel}</div>
                    {line.headingType && (
                      <div className="text-[10px] text-text-muted mt-0.5">{line.headingType}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-text truncate max-w-[160px]">{line.description}</div>
                    {line.colourName && (
                      <div className="text-[10px] text-text-muted font-data">{line.colourwayCode} · {line.colourName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-text">
                    {line.panels ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-text">
                    {mm(line.cutLengthMm)}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-text">
                    {metres(line.fabricIssuedM)}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-text">
                    {metres(line.actualUsedM)}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-text">
                    {metres(line.wastageM)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {line.qcPassed ? (
                      <span className="text-solid text-[11px] font-medium">✓ Pass</span>
                    ) : (
                      <span className="text-text-subtle text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline */}
      {(job.startedAt || job.completedAt) && (
        <div className="mt-4 flex gap-6 text-[12px] text-text-muted">
          {job.startedAt && (
            <span>Started: <span className="text-text font-data">{new Date(job.startedAt).toLocaleDateString("en-IN")}</span></span>
          )}
          {job.targetDate && (
            <span>Target: <span className="text-text font-data">{new Date(job.targetDate).toLocaleDateString("en-IN")}</span></span>
          )}
          {job.completedAt && (
            <span>Completed: <span className="text-solid font-data">{new Date(job.completedAt).toLocaleDateString("en-IN")}</span></span>
          )}
        </div>
      )}
    </div>
  );
}
