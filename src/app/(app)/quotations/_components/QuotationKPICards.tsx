import { FileText, PencilLine, Send, CheckCircle2, XCircle, Clock, IndianRupee } from "lucide-react";
import type { QuotationKPIs } from "@/modules/quotations/queries";

function fmtINR(paiseStr: string): string {
  try {
    const n = BigInt(paiseStr);
    const r = n / 100n;
    const s = r.toString();
    if (s.length <= 3) return `₹${s}`;
    const l3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return `₹${rest},${l3}`;
  } catch { return "₹0"; }
}

interface KPICard {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tone: string;      // Tailwind classes for icon wrapper bg + text
  valueTone?: string;
}

export function QuotationKPICards({ kpis }: { kpis: QuotationKPIs }) {
  const cards: KPICard[] = [
    {
      label: "Total Quotations",
      value: kpis.total,
      sub: `${(kpis.byStatus.DRAFT ?? 0) + (kpis.byStatus.PENDING_APPROVAL ?? 0) + (kpis.byStatus.APPROVED ?? 0) + (kpis.byStatus.SENT ?? 0)} active`,
      icon: <FileText size={16} strokeWidth={1.75} />,
      tone: "bg-text-dim/10 text-text-dim",
    },
    {
      label: "Draft",
      value: kpis.byStatus.DRAFT ?? 0,
      sub: "awaiting completion",
      icon: <PencilLine size={16} strokeWidth={1.75} />,
      tone: "bg-text-dim/10 text-text-dim",
    },
    {
      label: "Sent",
      value: kpis.byStatus.SENT ?? 0,
      sub: "awaiting response",
      icon: <Send size={16} strokeWidth={1.75} />,
      tone: "bg-solid/10 text-solid",
      valueTone: "text-solid",
    },
    {
      label: "Accepted",
      value: kpis.byStatus.ACCEPTED ?? 0,
      sub: "ready to order",
      icon: <CheckCircle2 size={16} strokeWidth={1.75} />,
      tone: "bg-solid/10 text-solid",
      valueTone: "text-solid",
    },
    {
      label: "Rejected",
      value: kpis.byStatus.REJECTED ?? 0,
      sub: "lost",
      icon: <XCircle size={16} strokeWidth={1.75} />,
      tone: "bg-fault/10 text-fault",
      valueTone: kpis.byStatus.REJECTED ? "text-fault" : undefined,
    },
    {
      label: "Expiring Soon",
      value: kpis.expiringSoon,
      sub: "within 7 days",
      icon: <Clock size={16} strokeWidth={1.75} />,
      tone: "bg-heat/12 text-heat",
      valueTone: kpis.expiringSoon > 0 ? "text-heat" : undefined,
    },
    {
      label: "Total Value",
      value: fmtINR(kpis.totalValueStr),
      sub: "all quotes",
      icon: <IndianRupee size={16} strokeWidth={1.75} />,
      tone: "bg-gold/10 text-gold",
      valueTone: "text-gold",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-[14px] bg-surface border border-rule px-5 py-4 flex flex-col gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-[8px] shrink-0 ${c.tone}`}>
              {c.icon}
            </span>
          </div>
          <div className={`font-data text-[26px] font-semibold tabular leading-none ${c.valueTone ?? "text-text"}`}>
            {c.value}
          </div>
          <div className="text-[12px] font-medium text-text-dim leading-snug">{c.label}</div>
          {c.sub && (
            <div className="text-[11px] text-text-subtle leading-none">{c.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}
