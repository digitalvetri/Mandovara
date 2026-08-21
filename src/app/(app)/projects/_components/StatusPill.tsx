import type { ProjectStage } from "@/modules/projects/schema";

const TONE: Record<ProjectStage, string> = {
  ENQUIRY:       "bg-text-dim/12 text-text-dim",
  SITE_VISIT:    "bg-info/15 text-info",
  MEASUREMENT:   "bg-info/15 text-info",
  QUOTATION:     "bg-warn/15 text-warn",
  ORDERED:       "bg-warn/15 text-warn",
  PROCUREMENT:   "bg-warn/15 text-warn",
  MAKE:          "bg-warn/15 text-warn",
  COMPLETED:     "bg-good/12 text-good",
  CANCELLED:     "bg-bad/12 text-bad line-through",
};
const LABEL: Record<ProjectStage, string> = {
  ENQUIRY: "Enquiry", SITE_VISIT: "Site Visit", MEASUREMENT: "Measurement",
  QUOTATION: "Quotation", ORDERED: "Ordered", PROCUREMENT: "Procurement",
  MAKE: "Make",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
};

export function ProjectStatusPill({ status }: { status: string }) {
  const tone = TONE[status as ProjectStage] ?? "bg-text-dim/12 text-text-dim";
  const label = LABEL[status as ProjectStage] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <span
      className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}
    >
      {label}
    </span>
  );
}
