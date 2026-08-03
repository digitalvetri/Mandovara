import type { POStatus } from "@/modules/purchase/schema";

const TONE: Record<POStatus, string> = {
  DRAFT:             "bg-text-dim/12 text-text-dim",
  ISSUED:            "bg-warn/15 text-warn",
  PARTIAL_RECEIVED:  "bg-warn/15 text-warn",
  RECEIVED:          "bg-good/12 text-good",
  CANCELLED:         "bg-bad/12 text-bad line-through",
};
const LABEL: Record<POStatus, string> = {
  DRAFT: "Draft", ISSUED: "Issued", PARTIAL_RECEIVED: "Partial",
  RECEIVED: "Received", CANCELLED: "Cancelled",
};

export function POStatusPill({ status }: { status: string }) {
  const tone = TONE[status as POStatus] ?? "bg-text-dim/12 text-text-dim";
  const label = LABEL[status as POStatus] ?? status;
  return (
    <span
      className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}
    >
      {label}
    </span>
  );
}
