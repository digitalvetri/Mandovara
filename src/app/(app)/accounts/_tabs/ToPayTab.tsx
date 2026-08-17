// "To Pay" tab — everything the business owes right now. Two groups:
// vendor bills (unpaid POs) and staff / office expenses. Overdue-first
// sort, with the days-until-due call-out red when negative.

import { devContext } from "@/lib/dev-context";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { can } from "@/kernel/rbac/guard";
import { loadToPay, type ToPayRow } from "@/modules/accounts/to-pay";
import { daysLateLabel } from "./_shared";
import { MarkPaidButton } from "../_components/MarkPaidButton";

interface Props {
  ctx: Awaited<ReturnType<typeof devContext>>;
}

export async function ToPayTab({ ctx }: Props) {
  if (!can(ctx, "expense.view")) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule px-6 py-14 text-center">
        <div className="text-[13.5px] text-text mb-1.5">You don't have permission to see this.</div>
        <p className="text-[11.5px] text-text-dim">
          Vendor bills and staff expenses are only visible to Owner and Accounts roles.
        </p>
      </div>
    );
  }

  const bundle = await loadToPay(ctx);
  const vendors = bundle.rows.filter((r) => r.kind === "PO");
  const staff   = bundle.rows.filter((r) => r.kind === "EXPENSE");

  if (bundle.rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule px-6 py-14 text-center">
        <div className="text-[14px] text-text mb-2">Nothing owed right now.</div>
        <p className="text-[12px] text-text-dim max-w-md mx-auto">
          When you raise a purchase order to a vendor or a staff expense gets approved but not yet
          paid, it'll show up here so you can plan the outflow.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-0.5">To pay</div>
        <div className="font-display text-[26px] font-semibold tabular-nums text-text leading-none">
          {formatINR(bundle.vendorTotal + bundle.expenseTotal)}
        </div>
        <div className="mt-1 text-[11.5px] text-text-dim">
          {bundle.overdueTotal > 0n && (
            <>
              <span className="text-bad tabular">{formatINR(bundle.overdueTotal)}</span>
              {" is overdue · "}
            </>
          )}
          {bundle.dueThisWeekTotal > 0n
            ? <><span className="text-warn tabular">{formatINR(bundle.dueThisWeekTotal)}</span>{" due this week"}</>
            : "None due this week"}
        </div>
      </div>

      {/* Vendor bills */}
      {vendors.length > 0 && (
        <Group
          title="Vendor bills"
          note={`${vendors.length} · ${formatINR(bundle.vendorTotal)}`}
          rows={vendors}
        />
      )}

      {/* Staff / office expenses */}
      {staff.length > 0 && (
        <Group
          title="Staff & office expenses"
          note={`${staff.length} · ${formatINR(bundle.expenseTotal)}`}
          rows={staff}
        />
      )}
    </>
  );
}

// ── Grouped list ────────────────────────────────────────────────

function Group({ title, note, rows }: { title: string; note: string; rows: ToPayRow[] }) {
  return (
    <section className="mb-5 rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 py-3 border-b border-rule">
        <div className="text-[13px] font-medium text-text">{title}</div>
        <div className="text-[11px] text-text-dim tabular">{note}</div>
      </div>
      <ul className="divide-y divide-rule/60">
        {rows.map((r) => (
          <li key={r.id} className="px-5 py-3.5 flex items-baseline justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                {r.number && (
                  <span className="text-[10.5px] tabular text-text-dim">{r.number}</span>
                )}
                <div className="text-[13px] text-text truncate">{r.label}</div>
              </div>
              <div className="text-[11px] text-text-dim">
                <span>{r.head}</span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className={r.daysUntilDue < 0 ? "text-bad" : r.daysUntilDue <= 7 ? "text-warn" : ""}>
                  {daysLateLabel(r.daysUntilDue)}
                </span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="tabular">{formatDate(r.dueDate)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="tabular text-[13.5px] text-text font-medium whitespace-nowrap">
                {formatINR(r.amount)}
              </div>
              {/* Mark-paid only on Expense rows for now — PO payment tracking
                  needs a schema addition (see docs/HANDOVER-CHECKLIST.md). */}
              {r.kind === "EXPENSE" && (
                <MarkPaidButton expenseId={r.id.slice("exp:".length)} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

