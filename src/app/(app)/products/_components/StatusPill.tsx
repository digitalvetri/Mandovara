import type { ProductStatus } from "@/modules/products/schema";

const TONE: Record<ProductStatus, string> = {
  ACTIVE:       "bg-good/12 text-good",
  INACTIVE:     "bg-text-dim/12 text-text-dim",
  DISCONTINUED: "bg-bad/12 text-bad",
};
const LABEL: Record<ProductStatus, string> = {
  ACTIVE:       "Active",
  INACTIVE:     "Inactive",
  DISCONTINUED: "Discontinued",
};

export function StatusPill({ status }: { status: string }) {
  const key = status as ProductStatus;
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
