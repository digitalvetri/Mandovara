// "Received" tab — every payment in, newest first. Filter chips for
// mode, cheque status, unmatched, and per-month drill-in from the
// InVsOut chart. Uses the extended listReceipts query.

import Link from "next/link";
import type { Route } from "next";
import { devContext } from "@/lib/dev-context";
import { listReceipts } from "@/modules/receipts/queries";
import { Pager } from "@/components/data/Pager";
import { formatINR } from "@/kernel/money/format";
import { ReceiptsTable } from "../_components/ReceiptsTable";

interface Props {
  ctx:  Awaited<ReturnType<typeof devContext>>;
  page: number;
  sort: "recent" | "oldest" | "amount";
  q?:   string;
  mode?: string;
  chequeStatus?: string;
  unmatched?: boolean;
  month?: string;
}

const MODE_LABELS: Record<string, string> = {
  UPI: "UPI", CASH: "Cash", NEFT: "Bank (NEFT)", RTGS: "Bank (RTGS)", CHEQUE: "Cheque", CARD: "Card",
};

export async function ReceivedTab({
  ctx, page, sort, q, mode, chequeStatus, unmatched, month,
}: Props) {
  const receipts = await listReceipts(ctx, {
    ...(q != null && { search: q }),
    page, sort,
    ...(mode         && { mode }),
    ...(chequeStatus && { chequeStatus }),
    ...(unmatched    && { unmatched: true }),
    ...(month        && { month }),
  });

  const totalAmount = receipts.rows.reduce((s, r) => s + r.amount, 0n);

  const activeFilters: Array<{ label: string; clearHref: string }> = [];
  if (mode)         activeFilters.push({ label: MODE_LABELS[mode] ?? mode,           clearHref: dropParam("mode") });
  if (chequeStatus) activeFilters.push({ label: `Cheque · ${chequeStatus.toLowerCase()}`, clearHref: dropParam("status") });
  if (unmatched)    activeFilters.push({ label: "Not matched to a bill",              clearHref: dropParam("unmatched") });
  if (month)        activeFilters.push({ label: prettyMonth(month),                   clearHref: dropParam("month") });

  return (
    <>
      {/* Header — total on this page + filter chips */}
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
            Payments received
          </div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-text leading-none">
            {formatINR(totalAmount)}
          </div>
          <div className="mt-1 text-[11.5px] text-text-dim">
            {receipts.total} payment{receipts.total === 1 ? "" : "s"} in total
          </div>
        </div>
        <ModeChips activeMode={mode} activeUnmatched={!!unmatched} activePending={chequeStatus === "PENDING"} />
      </div>

      {/* Active filter breadcrumb */}
      {activeFilters.length > 0 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap text-[11.5px]">
          <span className="text-text-dim">Filtering by:</span>
          {activeFilters.map((f, i) => (
            <Link
              key={i}
              href={f.clearHref as Route}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-gold-tint text-text hover:bg-gold/20 transition-colors"
            >
              {f.label}
              <span className="text-text-dim">×</span>
            </Link>
          ))}
        </div>
      )}

      {receipts.rows.length === 0 ? (
        <EmptyReceipts hasFilter={activeFilters.length > 0} />
      ) : (
        <>
          <ReceiptsTable rows={receipts.rows} />
          <Pager page={page} pageSize={receipts.pageSize} total={receipts.total} />
        </>
      )}
    </>
  );
}

// ── Chips ────────────────────────────────────────────────────────

function ModeChips({
  activeMode, activeUnmatched, activePending,
}: { activeMode?: string; activeUnmatched: boolean; activePending: boolean }) {
  const modes = ["UPI", "CASH", "NEFT", "CHEQUE", "CARD"] as const;
  return (
    <div className="flex flex-wrap gap-1.5">
      {modes.map((m) => {
        const isActive = activeMode === m;
        const href = isActive
          ? ("/accounts?tab=received" as Route)
          : (`/accounts?tab=received&mode=${m}` as Route);
        return (
          <Chip key={m} active={isActive} href={href}>{MODE_LABELS[m] ?? m}</Chip>
        );
      })}
      <Chip
        active={activePending}
        href={activePending ? ("/accounts?tab=received" as Route) : ("/accounts?tab=received&status=PENDING&mode=CHEQUE" as Route)}
      >
        Cheque · pending
      </Chip>
      <Chip
        active={activeUnmatched}
        href={activeUnmatched ? ("/accounts?tab=received" as Route) : ("/accounts?tab=received&unmatched=1" as Route)}
      >
        Not matched
      </Chip>
    </div>
  );
}

function Chip({ active, href, children }: { active: boolean; href: Route; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center h-8 px-3 rounded-[8px] text-[11.5px] font-medium transition-colors border",
        active
          ? "bg-gold/10 border-gold text-text"
          : "border-rule text-text-dim hover:text-text hover:border-text-dim",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function EmptyReceipts({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule px-6 py-14 text-center">
      {hasFilter ? (
        <>
          <div className="text-[13.5px] text-text mb-1.5">No payments match this filter.</div>
          <Link href={"/accounts?tab=received" as Route} className="text-[12px] text-accent hover:underline">
            Clear all filters →
          </Link>
        </>
      ) : (
        <>
          <div className="text-[14px] text-text mb-2">No payments received yet.</div>
          <p className="text-[12px] text-text-dim">
            When you record a payment against a bill it'll show up here — newest first.
          </p>
        </>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

/** Build a query string that drops a single param from the current
 *  URL. Used by the active-filter breadcrumb chips. */
function dropParam(_name: string): string {
  // Server component — no window. Filter chips already know their
  // "clear" state; this returns a bare tab link because clearing any
  // single filter is easier UX than mutating the current URL.
  return "/accounts?tab=received";
}

function prettyMonth(month: string): string {
  const [yy, mm] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(yy, mm - 1, 1));
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}
