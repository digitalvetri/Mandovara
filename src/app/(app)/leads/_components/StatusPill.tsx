import { normalizeLeadStage, type ActiveLeadStage } from "@/modules/leads/schema";

// Only 4 sanctioned stages after the 25 Aug 2026 simplification.
// Any DB stage that isn't one of them is collapsed via normalizeLeadStage
// (CONTACTED / QUALIFIED / MEASURED etc → NEW · NEGOTIATION → QUOTED).

const TONE: Record<ActiveLeadStage, string> = {
  NEW:    "bg-accent/12 text-accent",
  QUOTED: "bg-good/12 text-good",
  WON:    "bg-good/15 text-good",
  LOST:   "bg-bad/12 text-bad",
};

const LABEL: Record<ActiveLeadStage, string> = {
  NEW:    "New",
  QUOTED: "Quoted",
  WON:    "Won",
  LOST:   "Lost",
};

export function StatusPill({ status }: { status: string }) {
  const key   = normalizeLeadStage(status);
  const tone  = TONE[key];
  const label = LABEL[key];
  return (
    <span
      className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}
    >
      {label}
    </span>
  );
}
