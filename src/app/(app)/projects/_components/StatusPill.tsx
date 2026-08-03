import type { ProjectStatus } from "@/modules/projects/schema";

const TONE: Record<ProjectStatus, string> = {
  PLANNING:  "bg-text-dim/12 text-text-dim",
  ACTIVE:    "bg-warn/15 text-warn",
  ON_HOLD:   "bg-warn/15 text-warn",
  COMPLETED: "bg-good/12 text-good",
  CANCELLED: "bg-bad/12 text-bad line-through",
};
const LABEL: Record<ProjectStatus, string> = {
  PLANNING: "Planning", ACTIVE: "Active", ON_HOLD: "On hold",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
};

export function ProjectStatusPill({ status }: { status: string }) {
  const tone = TONE[status as ProjectStatus] ?? "bg-text-dim/12 text-text-dim";
  const label = LABEL[status as ProjectStatus] ?? status;
  return (
    <span
      className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}
    >
      {label}
    </span>
  );
}
