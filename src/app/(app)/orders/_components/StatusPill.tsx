import type { OrderStatus } from "@/modules/orders/schema";

const ORDER_TONE: Record<OrderStatus, string> = {
  DRAFT:            "bg-text-dim/12 text-text-dim",
  CONFIRMED:        "bg-heat/15 text-heat",
  PROCUREMENT:      "bg-heat/15 text-heat",
  MAKE:             "bg-info/15 text-info",
  COMPLETED:        "bg-solid/12 text-solid",
  CANCELLED:        "bg-fault/12 text-fault",
};
const ORDER_LABEL: Record<OrderStatus, string> = {
  DRAFT:            "Draft",
  CONFIRMED:        "Confirmed",
  PROCUREMENT:      "Procurement",
  MAKE:             "Make",
  COMPLETED:        "Completed",
  CANCELLED:        "Cancelled",
};

export function StatusPill({ status }: { status: string }) {
  const key = status as OrderStatus;
  const tone = ORDER_TONE[key] ?? "bg-text-dim/12 text-text-dim";
  const label = ORDER_LABEL[key] ?? status;
  return (
    <span
      className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}
    >
      {label}
    </span>
  );
}
