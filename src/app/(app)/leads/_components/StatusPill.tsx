import type { LeadStage } from "@/modules/leads/schema";

// Single central stage-colour map — matches Prisma LeadStage enum.

const TONE: Record<LeadStage, string> = {
  NEW:                    "bg-accent/12 text-accent",
  CONTACTED:              "bg-warn/15 text-warn",
  QUALIFIED:              "bg-info/15 text-info",
  MEASUREMENT_SCHEDULED:  "bg-warn/15 text-warn",
  VISIT_SCHEDULED:        "bg-warn/15 text-warn",
  MEASURED:               "bg-info/15 text-info",
  QUOTED:                 "bg-good/12 text-good",
  NEGOTIATION:            "bg-good/12 text-good",
  WON:                    "bg-good/15 text-good",
  LOST:                   "bg-bad/12 text-bad",
};

const LABEL: Record<LeadStage, string> = {
  NEW:                    "New",
  CONTACTED:              "Contacted",
  QUALIFIED:              "Qualified",
  MEASUREMENT_SCHEDULED:  "Meas. Scheduled",
  VISIT_SCHEDULED:        "Site Visit",
  MEASURED:               "Measured",
  QUOTED:                 "Quoted",
  NEGOTIATION:            "Negotiation",
  WON:                    "Won",
  LOST:                   "Lost",
};

export function StatusPill({ status }: { status: string }) {
  const key = status as LeadStage;
  const tone = TONE[key] ?? "bg-text-dim/12 text-text-dim";
  const label = LABEL[key] ?? status;
  return (
    <span
      className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}
    >
      {label}
    </span>
  );
}
