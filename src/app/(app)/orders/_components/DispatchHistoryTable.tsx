import Link from "next/link";
import type { Route } from "next";
import { Truck } from "lucide-react";
import type { DispatchRow } from "@/modules/orders/dispatch-queries";

const STATUS_TONE: Record<string, string> = {
  SCHEDULED:   "bg-heat/15 text-heat",
  IN_PROGRESS: "bg-info/15 text-info",
  COMPLETED:   "bg-solid/12 text-solid",
  PARTIAL:     "bg-heat/15 text-heat",
  RESCHEDULED: "bg-rule text-text-muted",
  CANCELLED:   "bg-fault/12 text-fault",
};
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED:   "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
  PARTIAL:     "Partial",
  RESCHEDULED: "Rescheduled",
  CANCELLED:   "Cancelled",
};

const fmt = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtShort = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export function DispatchHistoryTable({ rows }: { rows: DispatchRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule p-12 text-center">
        <Truck size={24} className="text-text-subtle mx-auto mb-3" />
        <p className="text-[13px] font-medium text-text-muted">No dispatch records yet.</p>
        <p className="text-[12px] text-text-subtle mt-1">
          Use <strong>New Dispatch</strong> to schedule a delivery from a sales order.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto mb-4">
      <table className="w-full text-[12.5px] min-w-[820px]">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
            {["Dispatch #", "Sales Order", "Client", "Items", "Date", "Vehicle", "Delivery", "Status"].map((h) => (
              <th key={h} className="px-4 h-[34px] text-left font-medium first:pl-5 last:pr-5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
              <td className="px-4 py-2.5 pl-5">
                <Link
                  href={`/orders/${r.orderId}` as Route}
                  className="font-medium tabular-nums text-text hover:text-gold transition-colors"
                >
                  {r.number}
                </Link>
              </td>
              <td className="px-4 py-2.5">
                <Link
                  href={`/orders/${r.orderId}` as Route}
                  className="tabular-nums text-text-muted hover:text-gold transition-colors"
                >
                  {r.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-text">{r.clientName}</td>
              <td className="px-4 py-2.5 text-text-muted max-w-[180px] truncate">{r.itemSummary}</td>
              <td className="px-4 py-2.5 tabular-nums text-text-muted whitespace-nowrap">{fmt(r.scheduledAt)}</td>
              <td className="px-4 py-2.5 text-text-muted">{r.vehicle ?? "—"}</td>
              <td className="px-4 py-2.5">
                {r.completedAt ? (
                  <span className="tabular-nums text-solid text-[11.5px]">{fmtShort(r.completedAt)}</span>
                ) : r.expectedDeliveryAt ? (
                  <span className="tabular-nums text-text-muted text-[11.5px]">
                    {fmtShort(new Date(r.expectedDeliveryAt))}
                  </span>
                ) : (
                  <span className="text-text-subtle">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 pr-5">
                <span
                  className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${
                    STATUS_TONE[r.status] ?? "bg-rule text-text-muted"
                  }`}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
