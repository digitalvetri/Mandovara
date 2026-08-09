import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listLeads } from "@/modules/leads/queries";
import { LEAD_STATUSES } from "@/modules/leads/schema";
import { Pager } from "@/components/data/Pager";
import { LeadFilters } from "./_components/LeadFilters";
import { LeadsTable } from "./_components/LeadsTable";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  stage?: string;
  status?: string;
  page?: string;
  sort?: string;
}

export default async function LeadsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q = params.q?.trim();
  const stage = normaliseStage(params.stage ?? params.status);
  const page = parsePositiveInt(params.page) ?? 1;
  const sort = (params.sort as "recent" | "oldest" | "name" | "value" | undefined) ?? "recent";

  const { rows, total, pageSize } = await listLeads(ctx, {
    ...(q != null && { search: q }),
    stage, page, sort,
  });

  return (
    <>
      <Topbar
        title="Lead Management"
        eyebrow={`${total} lead${total === 1 ? "" : "s"} · ${filterEyebrow(stage, q)}`}
        actions={
          <Link href={"/leads/new" as Route}>
            <PrimaryButton>New Lead</PrimaryButton>
          </Link>
        }
      />
      <LeadFilters />
      <LeadsTable rows={rows} />
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function normaliseStage(v: string | undefined): string | "OPEN" | "ALL" {
  if (v == null || v === "") return "ALL";
  if (v === "OPEN" || v === "ALL") return v;
  if ((LEAD_STATUSES as readonly string[]).includes(v)) return v;
  return "ALL";
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function filterEyebrow(status: string, q: string | undefined): string {
  const bits: string[] = [];
  if (status === "OPEN") bits.push("open pipeline");
  else if (status === "ALL") bits.push("all statuses");
  else bits.push(status.toLowerCase());
  if (q) bits.push(`matching "${q}"`);
  return bits.join(" · ");
}
