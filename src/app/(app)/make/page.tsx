import Link from "next/link";
import type { Route } from "next";
import { Scissors, Plus } from "lucide-react";
import { devContext } from "@/lib/dev-context";
import { listMakeJobs } from "@/modules/make/queries";
import { MAKE_KANBAN_COLUMNS, MAKE_STATUS_LABELS, MAKE_STATUS_COLORS, PRIORITY_LABELS } from "@/modules/make/schema";
import type { MakeJobRow } from "@/modules/make/queries";

export const dynamic = "force-dynamic";

const PRIORITY_COLORS: Record<number, string> = {
  0: "text-text-subtle",
  1: "text-heat",
  2: "text-fault font-semibold",
};

function MakeJobCard({ job }: { job: MakeJobRow }) {
  const overdue =
    job.targetDate && !job.completedAt && new Date(job.targetDate) < new Date();

  return (
    <Link
      href={`/make/${job.id}` as Route}
      className="block bg-surface border border-border rounded-lg p-3 hover:border-gold/40 transition-colors"
    >
      {/* Header row: number + priority */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-data text-[10.5px] text-text-muted">{job.number}</span>
        {job.priority > 0 && (
          <span className={`text-[9.5px] uppercase tracking-wide ${PRIORITY_COLORS[job.priority] ?? ""}`}>
            {PRIORITY_LABELS[job.priority]}
          </span>
        )}
      </div>

      {/* Project + client */}
      <div className="text-[12.5px] font-medium text-text truncate leading-snug">
        {job.projectName}
      </div>
      <div className="text-[11px] text-text-muted truncate">{job.clientName}</div>

      {/* Sales order */}
      <div className="mt-1 text-[10.5px] text-text-subtle tabular-nums">
        {job.orderNumber}
      </div>

      {/* Measurement revision */}
      {job.measurementRevision && (
        <div className="mt-0.5 text-[10px] text-text-subtle truncate">
          Rev: {job.measurementRevision}
        </div>
      )}

      {/* Footer row */}
      <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-subtle">
            {job.lineCount} line{job.lineCount !== 1 ? "s" : ""}
          </span>
          {job.assignedToName && (
            <span className="text-[10px] text-text-muted truncate max-w-[72px]">
              · {job.assignedToName}
            </span>
          )}
        </div>
        {job.targetDate && (
          <span className={`text-[10px] font-data ${overdue ? "text-fault" : "text-text-muted"}`}>
            {new Date(job.targetDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            {overdue ? " ⚠" : ""}
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function MakePage() {
  const ctx = await devContext();
  const allJobs = await listMakeJobs(ctx);

  const byStatus = new Map<string, MakeJobRow[]>();
  for (const col of MAKE_KANBAN_COLUMNS) byStatus.set(col, []);
  for (const job of allJobs) {
    const col = byStatus.get(job.status);
    if (col) col.push(job);
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Scissors size={22} className="text-gold" strokeWidth={1.5} />
          <div>
            <h1 className="text-[22px] font-display font-semibold text-text leading-none">
              Make
            </h1>
            <p className="text-[12px] text-text-muted mt-0.5">
              Cut &amp; stitch job tracking — {allJobs.length} active job{allJobs.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link
          href={"/make/new" as Route}
          className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[8px] bg-accent text-white text-[12px] font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus size={13} strokeWidth={2.5} />
          New job
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {MAKE_KANBAN_COLUMNS.map((col) => {
          const jobs = byStatus.get(col) ?? [];
          return (
            <div key={col} className="flex-shrink-0 w-[224px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${MAKE_STATUS_COLORS[col] ?? ""}`}>
                  {MAKE_STATUS_LABELS[col]}
                </span>
                <span className="text-[11px] text-text-muted font-data">{jobs.length}</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[80px] bg-ink/30 rounded-lg p-2">
                {jobs.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-text-subtle py-6">
                    Empty
                  </div>
                ) : (
                  jobs.map((job) => <MakeJobCard key={job.id} job={job} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
