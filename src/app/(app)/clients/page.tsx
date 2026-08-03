import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listClients } from "@/modules/clients/queries";
import { CLIENT_TYPES, type ClientType } from "@/modules/clients/schema";
import { ClientFilters } from "./_components/ClientFilters";
import { ClientsTable } from "./_components/ClientsTable";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  type?: string;
  page?: string;
  sort?: string;
}

export default async function ClientsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q = params.q?.trim();
  const type = normaliseType(params.type);
  const page = parsePositiveInt(params.page) ?? 1;
  const sort = (params.sort as "recent" | "name" | "outstanding" | undefined) ?? "recent";

  const { rows, total, pageSize } = await listClients(ctx, {
    ...(q != null && { search: q }),
    type,
    page,
    sort,
  });

  return (
    <>
      <Topbar
        title="Client 360"
        eyebrow={`${total} client${total === 1 ? "" : "s"} · ${eyebrowFor(type, q)}`}
        actions={
          <Link href={"/clients/new" as Route}>
            <PrimaryButton>New Client</PrimaryButton>
          </Link>
        }
      />
      <ClientFilters />
      <ClientsTable rows={rows} />
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function normaliseType(v: string | undefined): ClientType | "ALL" {
  if (v == null || v === "" || v === "ALL") return "ALL";
  if ((CLIENT_TYPES as readonly string[]).includes(v)) return v as ClientType;
  return "ALL";
}
function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
function eyebrowFor(type: string, q: string | undefined): string {
  const bits: string[] = [];
  bits.push(type === "ALL" ? "all types" : type.toLowerCase());
  if (q) bits.push(`matching "${q}"`);
  return bits.join(" · ");
}
