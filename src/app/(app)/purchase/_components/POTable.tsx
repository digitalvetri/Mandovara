import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { PORow } from "@/modules/purchase/queries";
import { POStatusPill } from "./StatusPill";
import type { POStatus } from "@/modules/purchase/schema";

const STATUS_STRIP: Record<POStatus, string> = {
  DRAFT:            "bg-border",
  PENDING_APPROVAL: "bg-info",
  APPROVED:         "bg-info",
  SENT:             "bg-heat",
  PARTIAL:          "bg-heat",
  RECEIVED:         "bg-solid",
  CANCELLED:        "bg-fault/40",
};

export function POTable({ rows }: { rows: PORow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-10 text-center">
        <div className="text-[14px] font-medium text-text mb-1.5">No purchase orders yet.</div>
        <p className="text-[12px] text-text-dim">
          Add a vendor and raise your first PO to start receiving stock.{" "}
          <Link href={"/purchase/new" as Route} className="text-accent hover:underline">New PO →</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-rule bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-2 border-b border-rule">
            <th className="w-[5px] p-0" aria-hidden />
            <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">PO Number</th>
            <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Vendor</th>
            <th className="px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden sm:table-cell">Lines</th>
            <th className="px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Total</th>
            <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden md:table-cell">Expected by</th>
            <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const strip = STATUS_STRIP[r.status as POStatus] ?? "bg-border";
            const overdue = r.expectedAt != null && r.expectedAt < new Date() &&
              !["RECEIVED", "CANCELLED"].includes(r.status);
            return (
              <tr
                key={r.id}
                className={[
                  "group relative transition-colors hover:bg-surface-2/60",
                  i > 0 ? "border-t border-rule" : "",
                ].join(" ")}
              >
                <td className="p-0 w-[5px]">
                  <div className={`h-full w-[5px] min-h-[64px] ${strip}`} />
                </td>

                <td className="px-4 py-4">
                  <Link
                    href={`/purchase/${r.id}` as Route}
                    className="block tabular text-[13px] font-semibold text-accent hover:underline"
                  >
                    {r.number.split("/").pop() ?? r.number}
                  </Link>
                  <div className="tabular text-[11px] text-text-faint mt-0.5">
                    {formatDate(r.date)}
                  </div>
                </td>

                <td className="px-4 py-4 max-w-[200px]">
                  <div className="text-[13px] font-medium text-text truncate">{r.vendorName}</div>
                </td>

                <td className="px-4 py-4 text-right tabular text-[12.5px] text-text-dim hidden sm:table-cell">
                  {r.lineCount}
                </td>

                <td className="px-4 py-4 text-right">
                  <span className="tabular text-[13px] font-medium text-text">{formatINR(r.totalValue)}</span>
                </td>

                <td className="px-4 py-4 hidden md:table-cell">
                  {r.expectedAt ? (
                    <span className={`tabular text-[12.5px] ${overdue ? "text-fault font-medium" : "text-text-dim"}`}>
                      {formatDate(r.expectedAt)}
                      {overdue && <span className="ml-1 text-[10px] uppercase tracking-[0.06em]">overdue</span>}
                    </span>
                  ) : (
                    <span className="text-text-faint text-[12.5px]">—</span>
                  )}
                </td>

                <td className="px-4 py-4">
                  <POStatusPill status={r.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "2-digit",
  }).format(d);
}
