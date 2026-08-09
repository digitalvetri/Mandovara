import type { InvoiceStatus, IrnStatus } from "@/modules/invoices/schema";

// OVERDUE is a display-only state computed from dueDate — it's not in the DB enum.
type DisplayStatus = InvoiceStatus | "OVERDUE";

const TONE: Record<DisplayStatus, string> = {
  DRAFT:          "bg-text-dim/12 text-text-dim",
  ISSUED:         "bg-warn/15 text-warn",
  PARTIALLY_PAID: "bg-warn/15 text-warn",
  PAID:           "bg-good/12 text-good",
  CANCELLED:      "bg-text-dim/12 text-text-dim line-through",
  OVERDUE:        "bg-bad/12 text-bad",
};
const LABEL: Record<DisplayStatus, string> = {
  DRAFT: "Draft", ISSUED: "Issued", PARTIALLY_PAID: "Partial",
  PAID: "Paid", CANCELLED: "Cancelled", OVERDUE: "Overdue",
};

export function StatusPill({ status }: { status: string }) {
  const key = status as InvoiceStatus;
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

const IRN_TONE: Record<IrnStatus, string> = {
  NOT_REQUIRED: "bg-text-dim/12 text-text-dim",
  PENDING:      "bg-warn/15 text-warn",
  GENERATED:    "bg-good/12 text-good",
  FAILED:       "bg-bad/12 text-bad",
  CANCELLED:    "bg-text-dim/12 text-text-dim line-through",
};
const IRN_LABEL: Record<IrnStatus, string> = {
  NOT_REQUIRED: "N/A", PENDING: "Pending",
  GENERATED: "Generated", FAILED: "Failed", CANCELLED: "Cancelled",
};

export function IrnPill({ status }: { status: string }) {
  const key = status as IrnStatus;
  const tone = IRN_TONE[key] ?? "bg-text-dim/12 text-text-dim";
  const label = IRN_LABEL[key] ?? status;
  return (
    <span
      className={`inline-block text-[10px] font-medium tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-[3px] ${tone}`}
      title={`IRN ${label}`}
    >
      IRN · {label}
    </span>
  );
}
