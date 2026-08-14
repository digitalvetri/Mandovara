import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Scissors } from "lucide-react";
import { devContext } from "@/lib/dev-context";
import { getMakeJob } from "@/modules/make/queries";
import {
  MAKE_STATUS_LABELS,
  MAKE_STATUS_COLORS,
  MAKE_STATUS_NEXT,
  MAKE_KANBAN_COLUMNS,
  PRIORITY_LABELS,
} from "@/modules/make/schema";
import { AdvanceMakeJobButton } from "./_components/AdvanceMakeJobButton";
import { PrintButton } from "./_components/PrintButton";
import { QCForm } from "./_components/QCForm";
import { ActivityTimeline } from "./_components/ActivityTimeline";

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

function StageStepper({ current }: { current: string }) {
  const steps = MAKE_KANBAN_COLUMNS;
  const currentIdx = steps.indexOf(current as typeof steps[number]);

  return (
    <div className="flex items-center gap-0 text-[10.5px] overflow-x-auto">
      {steps.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const rework  = step === "REWORK" && current === "REWORK";
        return (
          <div key={step} className="flex items-center">
            <div
              className={`px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                active && rework
                  ? "bg-fault/20 text-fault font-semibold"
                  : active
                  ? "bg-gold/20 text-gold font-semibold"
                  : done
                  ? "text-solid"
                  : "text-text-subtle"
              }`}
            >
              {MAKE_STATUS_LABELS[step]}
            </div>
            {i < steps.length - 1 && (
              <span className={`mx-0.5 ${done || active ? "text-text-muted" : "text-border"}`}>›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function MakeJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const ctx = await devContext();
  const job = await getMakeJob(ctx, jobId);
  if (!job) notFound();

  const nextStatus = MAKE_STATUS_NEXT[job.status];
  const isQCStage  = job.status === "QC";
  const isRework   = job.status === "REWORK";

  return (
    <div className="py-6 max-w-5xl">
      {/* Back */}
      <Link
        href={"/make" as Route}
        className="inline-flex items-center gap-1.5 text-[11.5px] text-text-muted hover:text-gold transition-colors mb-4"
      >
        <ArrowLeft size={12} />
        All jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scissors size={14} className="text-gold" strokeWidth={1.5} />
            <span className="font-data text-[12.5px] text-text-muted">{job.number}</span>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${MAKE_STATUS_COLORS[job.status] ?? "bg-surface-2 text-text-muted"}`}>
              {MAKE_STATUS_LABELS[job.status] ?? job.status}
            </span>
            {job.priority > 0 && (
              <span className={`text-[10px] font-semibold ${job.priority === 2 ? "text-fault" : "text-heat"}`}>
                {PRIORITY_LABELS[job.priority]}
              </span>
            )}
          </div>
          <h1 className="text-[20px] font-display font-semibold text-text">{job.projectName}</h1>
          <p className="text-[13px] text-text-muted">
            {job.clientName}
            {" · "}
            <Link href={`/orders/${job.orderId}` as Route} className="hover:text-gold transition-colors">
              Order {job.orderNumber}
            </Link>
          </p>
          {job.vendorName && (
            <p className="text-[12px] text-text-subtle mt-0.5">Vendor: {job.vendorName}</p>
          )}
          {job.assignedToName && (
            <p className="text-[12px] text-text-subtle">Assigned: {job.assignedToName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <PrintButton />
          {!isQCStage && nextStatus && (
            <AdvanceMakeJobButton jobId={job.id} nextStatus={nextStatus} />
          )}
        </div>
      </div>

      {/* Stage stepper */}
      <div className="mb-5 bg-surface border border-border rounded-lg px-4 py-2.5 overflow-x-auto">
        <StageStepper current={job.status} />
      </div>

      {/* Rework notice */}
      {isRework && (
        <div className="mb-4 rounded-lg border border-fault/40 bg-fault/10 px-4 py-3">
          <p className="text-[12.5px] text-fault font-medium">
            This job failed QC and is in rework.
          </p>
          <p className="text-[11.5px] text-text-muted mt-0.5">
            See activity log below for defects and rework notes. Advance to QC when rework is complete.
          </p>
          {nextStatus && (
            <div className="mt-2">
              <AdvanceMakeJobButton jobId={job.id} nextStatus={nextStatus} />
            </div>
          )}
        </div>
      )}

      {/* Dates strip */}
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-text-muted">
        {job.startedAt && (
          <span>
            Started:{" "}
            <span className="text-text font-data">
              {new Date(job.startedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </span>
        )}
        {job.targetDate && (
          <span>
            Due:{" "}
            <span className={`font-data ${!job.completedAt && new Date(job.targetDate) < new Date() ? "text-fault" : "text-text"}`}>
              {new Date(job.targetDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </span>
        )}
        {job.completedAt && (
          <span>
            Completed:{" "}
            <span className="text-solid font-data">
              {new Date(job.completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </span>
        )}
      </div>

      {/* Cut list */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-text">Cut List</h2>
          <p className="text-[11px] text-text-muted">
            Derived from approved measurement — do not re-derive
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 text-text-muted font-medium">Room / Label</th>
                <th className="px-4 py-2.5 text-text-muted font-medium">Material</th>
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
                    <div className="text-text font-medium leading-snug">{line.roomLabel}</div>
                    {line.headingType && (
                      <div className="text-[10px] text-text-muted mt-0.5">{line.headingType}</div>
                    )}
                    {line.measurementNumber && (
                      <div className="text-[10px] text-text-subtle font-data mt-0.5">
                        {line.measurementNumber}
                        {line.measurementStatus === "APPROVED" && (
                          <span className="text-solid ml-1">✓</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-text truncate max-w-[160px] leading-snug">{line.description}</div>
                    {line.colourName && (
                      <div className="text-[10px] text-text-muted font-data">
                        {line.colourwayCode} · {line.colourName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-text">
                    {line.panels ?? "—"}
                    {line.eyeletCount ? (
                      <div className="text-[10px] text-text-muted">{line.eyeletCount} eyelets</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-text">{mm(line.cutLengthMm)}</td>
                  <td className="px-4 py-3 text-right font-data text-text">{metres(line.fabricIssuedM)}</td>
                  <td className="px-4 py-3 text-right font-data text-text">{metres(line.actualUsedM)}</td>
                  <td className="px-4 py-3 text-right font-data text-text">{metres(line.wastageM)}</td>
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

      {/* QC form — only when in QC stage */}
      {isQCStage && <QCForm jobId={job.id} />}

      {/* Activity timeline */}
      <ActivityTimeline events={job.events} />
    </div>
  );
}
