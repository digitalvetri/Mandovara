import { devContext } from "@/lib/dev-context";
import { listMakeJobs } from "@/modules/make/queries";
import { MAKE_KANBAN_COLUMNS, MAKE_STATUS_LABELS } from "@/modules/make/schema";
import type { MakeJobRow } from "@/modules/make/queries";
import { Scissors } from "lucide-react";

export const dynamic = "force-dynamic";

function statusColor(status: string) {
  switch (status) {
    case "QUEUED": return "bg-surface-2 text-text-muted";
    case "CUTTING": return "bg-info/15 text-info";
    case "STITCHING": return "bg-heat/15 text-heat";
    case "FINISHING": return "bg-heat/15 text-heat";
    case "QC": return "bg-gold-tint text-gold";
    case "READY": return "bg-solid/15 text-solid";
    case "DELIVERED": return "bg-solid/20 text-solid";
    default: return "bg-surface-2 text-text-muted";
  }
}

function MakeJobCard({ job }: { job: MakeJobRow }) {
  return (
    <a
      href={`/make/${job.id}`}
      className="block bg-surface border border-border rounded-lg p-3 hover:border-gold/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-data text-[11px] text-text-muted">{job.number}</span>
        {job.targetDate && (
          <span className="font-data text-[10px] text-text-muted">
            {new Date(job.targetDate).toLocaleDateString("en-IN", {
              day: "2-digit", month: "short",
            })}
          </span>
        )}
      </div>
      <div className="text-[13px] font-medium text-text truncate">{job.projectName}</div>
      <div className="text-[11px] text-text-muted truncate">{job.clientName}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-text-subtle">{job.lineCount} line{job.lineCount !== 1 ? "s" : ""}</span>
        {job.vendorName && (
          <span className="text-[10px] text-text-muted truncate max-w-[80px]">{job.vendorName}</span>
        )}
      </div>
    </a>
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
      <div className="flex items-center gap-3 mb-6">
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

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {MAKE_KANBAN_COLUMNS.map((col) => {
          const jobs = byStatus.get(col) ?? [];
          return (
            <div key={col} className="flex-shrink-0 w-[220px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor(col)}`}>
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
