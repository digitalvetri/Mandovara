// "To Collect" tab — every client who owes money, ranked by chase
// score, with the same row actions as the Overview Chase List (§9).
// Filter chips: age bucket. Bulk reminder + expand-to-bills are
// Phase 6 polish; skipped for MVP.

import Link from "next/link";
import type { Route } from "next";
import { devContext } from "@/lib/dev-context";
import { orgPrisma } from "@/kernel/db/rls";
import { loadChaseList } from "@/modules/accounts/chase";
import { formatINR } from "@/kernel/money/format";
import { ChaseList, type ChaseRowUI } from "../_components/ChaseList";

interface Props {
  ctx:    Awaited<ReturnType<typeof devContext>>;
  bucket?: string;   // 'current' | 'd0_30' | 'd31_60' | 'd60p' — filters the list
}

// Age-bucket → predicate on `oldestLateDays`
const BUCKET_MATCHES: Record<string, (d: number) => boolean> = {
  current: (d) => d < 0,
  d0_30:   (d) => d >= 0  && d <= 30,
  d31_60:  (d) => d >= 31 && d <= 60,
  d60p:    (d) => d > 60,
};

const BUCKET_LABELS: Record<string, string> = {
  current: "Not yet due",
  d0_30:   "0–30 days late",
  d31_60:  "31–60 days late",
  d60p:    "60+ days late",
};

export async function ToCollectTab({ ctx, bucket }: Props) {
  const [rawList, org] = await Promise.all([
    // Take up to 100 — bigger and it's a UX problem the owner won't solve
    // by scrolling. Beyond that, filter chips are the answer.
    loadChaseList(ctx, { take: 100 }),
    orgPrisma(ctx.orgId).organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } }),
  ]);
  const orgName = org?.name ?? "Mandovara";

  const bucketFilter = bucket && BUCKET_MATCHES[bucket] ? bucket : null;
  const filtered = bucketFilter
    ? rawList.filter((r) => BUCKET_MATCHES[bucketFilter]!(r.oldestLateDays))
    : rawList;

  const total = filtered.reduce((s, r) => s + r.outstanding, 0n);

  const rows: ChaseRowUI[] = filtered.map((c) => ({
    clientId:              c.clientId,
    clientName:            c.clientName,
    clientMobile:          c.clientMobile,
    outstanding:           c.outstanding.toString(),
    oldestLateDays:        c.oldestLateDays,
    lastContactedDaysAgo:  c.lastContactedDaysAgo,
    activePromiseDate:     c.activePromiseDate ? c.activePromiseDate.toISOString() : null,
  }));

  return (
    <>
      {/* Header — total + filter chips */}
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
            {bucketFilter ? `To collect · ${BUCKET_LABELS[bucketFilter]}` : "To collect"}
          </div>
          <div className="font-display text-[26px] font-semibold tabular-nums text-text leading-none">
            {formatINR(total)}
          </div>
          <div className="mt-1 text-[11.5px] text-text-dim">
            from {filtered.length} client{filtered.length === 1 ? "" : "s"}
            {bucketFilter && rawList.length !== filtered.length && (
              <> · {rawList.length - filtered.length} filtered out</>
            )}
          </div>
        </div>
        <FilterChips active={bucketFilter} />
      </div>

      {filtered.length === 0 ? (
        <EmptyBucket bucket={bucketFilter} allEmpty={rawList.length === 0} />
      ) : (
        <ChaseList rows={rows} totalCount={filtered.length} orgName={orgName} />
      )}
    </>
  );
}

// ── Filter chips ─────────────────────────────────────────────────

function FilterChips({ active }: { active: string | null }) {
  const items: Array<{ key: string | null; label: string }> = [
    { key: null,     label: "All" },
    { key: "d0_30",  label: "0–30 late" },
    { key: "d31_60", label: "31–60 late" },
    { key: "d60p",   label: "60+ late" },
  ];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {items.map((it) => {
        const isActive = active === it.key;
        const href = it.key
          ? (`/accounts?tab=to-collect&bucket=${it.key}` as Route)
          : ("/accounts?tab=to-collect" as Route);
        return (
          <Link
            key={it.label}
            href={href}
            className={[
              "inline-flex items-center h-8 px-3 rounded-[8px] text-[11.5px] font-medium transition-colors border",
              isActive
                ? "bg-gold/10 border-gold text-text"
                : "border-rule text-text-dim hover:text-text hover:border-text-dim",
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

function EmptyBucket({ bucket, allEmpty }: { bucket: string | null; allEmpty: boolean }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule px-6 py-14 text-center">
      {allEmpty ? (
        <>
          <div className="text-[14px] text-text mb-2">Everyone has paid.</div>
          <p className="text-[12px] text-text-dim max-w-md mx-auto">
            No client currently owes you money. When you raise a bill and it isn't paid, that
            client will appear here so you can follow up.
          </p>
        </>
      ) : (
        <>
          <div className="text-[13.5px] text-text mb-1.5">Nobody in this age band.</div>
          <p className="text-[11.5px] text-text-dim mb-3">
            {BUCKET_LABELS[bucket ?? ""] ?? "This filter"} matches no clients right now.
          </p>
          <Link href={"/accounts?tab=to-collect" as Route} className="text-[12px] text-accent hover:underline">
            Clear filter →
          </Link>
        </>
      )}
    </div>
  );
}
