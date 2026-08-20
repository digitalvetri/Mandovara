// Four KPI tiles at the top of the projects landing page.
// Mirrors the invoicing landing (InvoiceKpiCards) so the shell reads
// consistently: label · value · icon · muted subline.

import { formatINRShort } from "@/kernel/money/format";
import { HardHat, Ruler, AlarmClock, IndianRupee } from "lucide-react";
import type { ProjectKpis } from "@/modules/projects/queries";

interface Props { kpis: ProjectKpis; showFinancials?: boolean }

export function ProjectKpiCards({ kpis, showFinancials = false }: Props) {
  const cols = showFinancials ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2";
  return (
    <div className={`mb-4 grid gap-3 ${cols}`}>
      <Card
        label="Active"
        value={String(kpis.activeCount)}
        sub="ordered → installing"
        Icon={HardHat}
        tone="solid"
      />
      <Card
        label="Awaiting measurement"
        value={String(kpis.awaitingMeasurement)}
        sub={kpis.awaitingMeasurement === 0 ? "all measured" : "enquiry / visit / measure"}
        Icon={Ruler}
        tone={kpis.awaitingMeasurement > 0 ? "heat" : "solid"}
      />
      {showFinancials && (
        <Card
          label="Payments overdue"
          value={String(kpis.paymentsOverdueCount)}
          sub={kpis.paymentsOverdueCount === 0 ? "all clear" : "projects with late invoices"}
          Icon={AlarmClock}
          tone={kpis.paymentsOverdueCount > 0 ? "fault" : "solid"}
        />
      )}
      {showFinancials && (
        <Card
          label="Receivables"
          value={formatINRShort(kpis.receivablesTotal)}
          sub={kpis.receivablesTotal > 0n ? "outstanding across projects" : "nothing due"}
          Icon={IndianRupee}
          tone={kpis.receivablesTotal > 0n ? "heat" : "solid"}
        />
      )}
    </div>
  );
}

type Tone = "solid" | "heat" | "fault" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  solid: "text-solid",
  heat:  "text-heat",
  fault: "text-fault",
  muted: "text-text",
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
  label: string;
  value: string;
  sub?: string;
  Icon: typeof HardHat;
  tone: Tone;
}) {
  return (
    <div className="rounded-[14px] border border-rule bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
          <div className={`font-display text-[22px] font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
            {value}
          </div>
          {sub && <div className="mt-1 text-[10.5px] text-text-dim">{sub}</div>}
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_ICON[tone]}`}>
          <Icon size={13} />
        </div>
      </div>
    </div>
  );
}

