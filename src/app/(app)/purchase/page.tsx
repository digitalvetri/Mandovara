import Link from "next/link";
import type { Route } from "next";
import { ShoppingCart, TrendingUp, AlertTriangle, Plus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listPOs, getPOKPIs } from "@/modules/purchase/queries";
import { PO_STATUSES, type POStatus } from "@/modules/purchase/schema";
import { formatINR } from "@/kernel/money/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
}

export default async function PurchasePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q = params.q?.trim();
  const status = normaliseStatus(params.status);
  const page = parsePositiveInt(params.page) ?? 1;

  const [{ rows, total, pageSize }, kpis] = await Promise.all([
    listPOs(ctx, { ...(q != null && { search: q }), status, page }),
    getPOKPIs(ctx),
  ]);

  const { POTable } = await import("./_components/POTable");

  return (
    <>
      <Topbar
        title="Purchase & Vendors"
        eyebrow={`${total} PO${total === 1 ? "" : "s"} · ${eyebrowFor(status, q)}`}
        actions={
          <Link
            href={"/purchase/new" as Route}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-accent text-[12.5px] font-medium text-white hover:opacity-90 transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            New PO
          </Link>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard
          icon={<ShoppingCart size={16} />}
          label="Open POs"
          value={kpis.openCount.toLocaleString("en-IN")}
          accent="text-accent"
          bg="bg-accent/6"
          iconBg="bg-accent/10"
        />
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="Outstanding value"
          value={formatINR(kpis.outstandingValue)}
          accent="text-heat"
          bg="bg-heat/6"
          iconBg="bg-heat/10"
        />
        <KpiCard
          icon={<AlertTriangle size={16} />}
          label="Overdue"
          value={kpis.overdueCount.toLocaleString("en-IN")}
          accent={kpis.overdueCount > 0 ? "text-fault" : "text-solid"}
          bg={kpis.overdueCount > 0 ? "bg-fault/6" : "bg-solid/6"}
          iconBg={kpis.overdueCount > 0 ? "bg-fault/10" : "bg-solid/10"}
        />
      </div>

      {/* Tabs + filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 rounded-[10px] border border-rule bg-surface-2 p-1">
          <TabLink href="/purchase" label="Purchase Orders" active />
          <TabLink href="/purchase/vendors" label="Vendors" active={false} />
        </div>

        <div className="h-5 w-px bg-rule hidden sm:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip label="Open" href="/purchase" active={status === "OPEN"} />
          <StatusChip label="All" href="/purchase?status=ALL" active={status === "ALL"} />
          {PO_STATUSES.map((s) => (
            <StatusChip
              key={s}
              label={s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")}
              href={`/purchase?status=${s}` as Route}
              active={status === s}
            />
          ))}
        </div>
      </div>

      <POTable rows={rows} />
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function KpiCard({
  icon, label, value, accent, bg, iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  bg: string;
  iconBg: string;
}) {
  return (
    <div className={`rounded-[12px] border border-rule ${bg} px-5 py-4 flex items-center gap-4`}>
      <div className={`shrink-0 rounded-[8px] ${iconBg} w-10 h-10 flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-[0.1em] text-text-dim mb-0.5">{label}</div>
        <div className={`tabular text-[20px] font-semibold leading-tight ${accent}`}>{value}</div>
      </div>
    </div>
  );
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href as Route}
      className={[
        "rounded-[7px] px-4 py-1.5 text-[12.5px] font-medium transition-colors",
        active ? "bg-surface shadow-sm text-text" : "text-text-dim hover:text-text",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function StatusChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href as Route}
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-[11.5px] transition-colors",
        active
          ? "border border-accent bg-accent/8 text-accent font-medium"
          : "border border-rule text-text-dim hover:text-text hover:border-text-dim",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function normaliseStatus(v: string | undefined): POStatus | "OPEN" | "ALL" {
  if (v == null || v === "") return "OPEN";
  if (v === "OPEN" || v === "ALL") return v;
  if ((PO_STATUSES as readonly string[]).includes(v)) return v as POStatus;
  return "OPEN";
}
function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
function eyebrowFor(status: string, q: string | undefined): string {
  const bits: string[] = [];
  bits.push(
    status === "OPEN"
      ? "open"
      : status === "ALL"
        ? "all statuses"
        : status.toLowerCase().replace(/_/g, " "),
  );
  if (q) bits.push(`matching "${q}"`);
  return bits.join(" · ");
}
