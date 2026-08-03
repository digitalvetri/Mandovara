import type { QuotationStatus } from "@/modules/quotations/schema";

const TONE: Record<QuotationStatus, string> = {
  DRAFT:     "bg-text-dim/12 text-text-dim",
  SENT:      "bg-warn/15 text-warn",
  VIEWED:    "bg-warn/15 text-warn",
  ACCEPTED:  "bg-good/12 text-good",
  REJECTED:  "bg-bad/12 text-bad",
  EXPIRED:   "bg-bad/12 text-bad",
  CONVERTED: "bg-good/15 text-good",
};
const LABEL: Record<QuotationStatus, string> = {
  DRAFT: "Draft", SENT: "Sent", VIEWED: "Viewed", ACCEPTED: "Accepted",
  REJECTED: "Rejected", EXPIRED: "Expired", CONVERTED: "Converted",
};

export function StatusPill({ status }: { status: string }) {
  const key = status as QuotationStatus;
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
