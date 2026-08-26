import Link from "next/link";
import type { Route } from "next";
import { Ruler } from "lucide-react";
import type { ClientRoundRow } from "@/modules/measurement/queries-client";
import { StartMeasurementFromClientButton } from "./StartMeasurementFromClientButton";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted", APPROVED: "Approved", SUPERSEDED: "Superseded",
};
const STATUS_CLS: Record<string, string> = {
  DRAFT: "text-text-dim", SUBMITTED: "text-info", APPROVED: "text-good", SUPERSEDED: "text-text-faint",
};

export interface ClientMeasurementsCardProps {
  clientId: string;
  projects: Array<{ id: string; name: string; stage: string }>;
  rounds:   ClientRoundRow[];
  canMeasure: boolean;
}

export function ClientMeasurementsCard({
  clientId, projects, rounds, canMeasure,
}: ClientMeasurementsCardProps) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Measurements ({rounds.length})
        </div>
        <StartMeasurementFromClientButton
          clientId={clientId}
          projects={projects}
          canMeasure={canMeasure}
        />
      </div>

      {rounds.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Ruler size={18} className="text-text-faint" strokeWidth={1.5} />
          <div className="text-[12.5px] text-text-dim">No measurement rounds yet.</div>
          <div className="text-[11.5px] text-text-faint">
            Start one from the button above — a stub project is created for you if needed.
          </div>
        </div>
      ) : (
        <div>
          {rounds.map((r) => (
            <Link
              key={r.id}
              href={`/projects/${r.projectId}/measurements/${r.id}` as Route}
              className="flex items-center gap-3 py-2.5 border-b border-rule/60 last:border-0 hover:bg-surface-hover -mx-2 px-2 rounded-[6px] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-text tabular">{r.number}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] ${STATUS_CLS[r.status] ?? "text-text-dim"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <div className="text-[11.5px] text-text-dim mt-0.5 truncate">
                  {r.projectName} · {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
                </div>
              </div>
              <span className="text-[11.5px] text-text-dim tabular shrink-0">
                {r.visitedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
