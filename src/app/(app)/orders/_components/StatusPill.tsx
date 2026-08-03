import type { OrderStatus, DispatchStatus } from "@/modules/orders/schema";

const ORDER_TONE: Record<OrderStatus, string> = {
  DRAFT:            "bg-text-dim/12 text-text-dim",
  CONFIRMED:        "bg-warn/15 text-warn",
  PARTIAL_DISPATCH: "bg-warn/15 text-warn",
  DISPATCHED:       "bg-good/12 text-good",
  CANCELLED:        "bg-bad/12 text-bad",
};
const ORDER_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Draft", CONFIRMED: "Confirmed", PARTIAL_DISPATCH: "Partial",
  DISPATCHED: "Dispatched", CANCELLED: "Cancelled",
};

const DISPATCH_TONE: Record<DispatchStatus, string> = {
  DRAFT:     "bg-text-dim/12 text-text-dim",
  POSTED:    "bg-warn/15 text-warn",
  DELIVERED: "bg-good/12 text-good",
};
const DISPATCH_LABEL: Record<DispatchStatus, string> = {
  DRAFT: "Draft", POSTED: "Posted", DELIVERED: "Delivered",
};

export function StatusPill({ status, kind = "order" }: { status: string; kind?: "order" | "dispatch" }) {
  const isDispatch = kind === "dispatch";
  const tone = isDispatch
    ? DISPATCH_TONE[status as DispatchStatus] ?? "bg-text-dim/12 text-text-dim"
    : ORDER_TONE[status as OrderStatus] ?? "bg-text-dim/12 text-text-dim";
  const label = isDispatch
    ? DISPATCH_LABEL[status as DispatchStatus] ?? status
    : ORDER_LABEL[status as OrderStatus] ?? status;
  return (
    <span
      className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}
    >
      {label}
    </span>
  );
}
