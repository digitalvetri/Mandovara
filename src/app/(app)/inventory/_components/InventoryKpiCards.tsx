// Four KPI tiles across the top of the Stock tab.
// Same visual pattern as InvoiceKpiCards + ProjectKpiCards so every
// landing page in the app reads consistently.

import { Package, AlertTriangle, ShoppingCart, IndianRupee } from "lucide-react";
import type { InventoryKpis } from "@/modules/inventory/queries";

interface Props { kpis: InventoryKpis }

export function InventoryKpiCards({ kpis }: Props) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        label="Items"
        value={String(kpis.itemCount)}
        Icon={Package}
        tone="solid"
      />
      <Card
        label="Low stock"
        value={String(kpis.lowStockCount)}
        sub={kpis.lowStockCount === 0 ? "all above reorder" : "raise a PO"}
        Icon={AlertTriangle}
        tone={kpis.lowStockCount > 0 ? "fault" : "solid"}
      />
      <Card
        label="Open POs"
        value={String(kpis.openPoCount)}
        sub={kpis.openPoCount === 0 ? "nothing incoming" : "in transit"}
        Icon={ShoppingCart}
        tone={kpis.openPoCount > 0 ? "heat" : "muted"}
      />
      <Card
        label="Stock value"
        value={shortINR(kpis.stockValuePaise)}
        sub="at last cost"
        Icon={IndianRupee}
        tone="solid"
      />
    </div>
  );
}

type Tone = "solid" | "heat" | "fault" | "muted";
const TONE_TEXT: Record<Tone, string> = {
  solid: "text-solid", heat: "text-heat", fault: "text-fault", muted: "text-text",
};
const TONE_ICON: Record<Tone, string> = {
  solid: "bg-solid/12 text-solid",
  heat:  "bg-heat/12 text-heat",
  fault: "bg-fault/12 text-fault",
  muted: "bg-surface-2 text-text-dim",
};

function Card({
  label, value, sub, Icon, tone,
}: {
  label: string; value: string; sub?: string; Icon: typeof Package; tone: Tone;
}) {
  return (
    <div className="rounded-[14px] border border-rule bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
          <div className={`font-display text-[22px] font-semibold tabular-nums ${TONE_TEXT[tone]}`}>{value}</div>
          {sub && <div className="mt-1 text-[10.5px] text-text-dim">{sub}</div>}
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_ICON[tone]}`}>
          <Icon size={13} />
        </div>
      </div>
    </div>
  );
}

function shortINR(paise: bigint): string {
  if (paise === 0n) return "—";
  const rupees = Number(paise) / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)} Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(1)} L`;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
