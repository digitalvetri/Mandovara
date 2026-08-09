import type { QuotationStatus } from "@/modules/quotations/schema";

const TONE: Record<QuotationStatus, string> = {
  DRAFT:    "bg-text-dim/12 text-text-dim",
  SENT:     "bg-heat/15 text-heat",
  REVISED:  "bg-heat/15 text-heat",
  ACCEPTED: "bg-solid/12 text-solid",
  REJECTED: "bg-fault/12 text-fault",
  EXPIRED:  "bg-fault/12 text-fault",
};
const LABEL: Record<QuotationStatus, string> = {
  DRAFT:    "Draft",
  SENT:     "Sent",
  REVISED:  "Revised",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED:  "Expired",
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
