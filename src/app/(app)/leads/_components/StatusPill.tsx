import type { LeadStatus } from "@/modules/leads/schema";

// Single central status-colour map. §7.5 of BUILD-SPEC — one map, everywhere.

const TONE: Record<LeadStatus, string> = {
  NEW:         "bg-accent/12 text-accent",
  CONTACTED:   "bg-warn/15 text-warn",
  QUALIFIED:   "bg-warn/15 text-warn",
  PROPOSED:    "bg-good/12 text-good",
  NEGOTIATION: "bg-good/12 text-good",
  WON:         "bg-good/15 text-good",
  LOST:        "bg-bad/12 text-bad",
};

const LABEL: Record<LeadStatus, string> = {
  NEW:         "New",
  CONTACTED:   "Contacted",
  QUALIFIED:   "Qualified",
  PROPOSED:    "Proposed",
  NEGOTIATION: "Negotiation",
  WON:         "Won",
  LOST:        "Lost",
};

export function StatusPill({ status }: { status: string }) {
  const key = status as LeadStatus;
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
