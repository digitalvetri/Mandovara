// Four KPI tiles at the top of the invoicing landing page.
// Matches the "GreenEcocare"-style reference: count · net · outstanding
// · credit notes. Numbers use short-lakh formatting (₹4.0 L) instead
// of the full string when they get big, so the row scans at a glance.

import { Receipt, IndianRupee, AlarmClock, RotateCcw } from "lucide-react";
import type { InvoiceKpis } from "@/modules/invoices/queries";

interface Props { kpis: InvoiceKpis }

export function InvoiceKpiCards({ kpis }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
      <Card
        label="Invoices"
        value={String(kpis.taxInvoiceCount)}
        Icon={Receipt}
        tone="solid"
      />
      <Card
        label="Invoiced (net)"
        value={shortINR(kpis.invoicedNet)}
        Icon={IndianRupee}
        tone="solid"
      />
      <Card
        label="Invoiced outstanding"
        value={shortINR(kpis.outstanding)}
        sub={kpis.outstanding > 0n ? "on invoiced milestones" : "all clear"}
        Icon={AlarmClock}
        tone={kpis.outstanding > 0n ? "heat" : "solid"}
      />
      <Card
        label="Credit notes"
        value={String(kpis.creditNoteCount)}
        Icon={RotateCcw}
        tone={kpis.creditNoteCount > 0 ? "info" : "muted"}
      />
    </div>
  );
}

// ── One tile ───────────────────────────────────────────────
type Tone = "solid" | "heat" | "info" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  solid: "text-solid",
  heat:  "text-heat",
  info:  "text-info",
  muted: "text-text",
};

const TONE_ICON: Record<Tone, string> = {
  solid: "bg-solid/12 text-solid",
  heat:  "bg-heat/12 text-heat",
  info:  "bg-info/12 text-info",
  muted: "bg-surface-2 text-text-dim",
};

function Card({
  label, value, sub, Icon, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  Icon: typeof Receipt;
  tone: Tone;
}) {
  return (
    <div className="relative rounded-[14px] border border-rule bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-1">{label}</div>
          <div className={`font-display text-[22px] font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
            {value}
          </div>
          {sub && (
            <div className="mt-1 text-[10.5px] text-text-dim">{sub}</div>
          )}
        </div>
        <div className={`shrink-0 rounded-full h-8 w-8 flex items-center justify-center ${TONE_ICON[tone]}`}>
          <Icon size={13} />
        </div>
      </div>
    </div>
  );
}

// Compact Indian format — 12345678 → "1.2 Cr", 400000 → "4.0 L".
// Anything under 1 lakh renders in full so no precision is lost on small
// numbers that fit on the line easily.
function shortINR(paise: bigint): string {
  if (paise === 0n) return "₹0";
  const rupees = Number(paise) / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)} Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(1)} L`;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
