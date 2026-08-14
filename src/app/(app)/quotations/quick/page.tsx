// Quick quote — start from a client, pick catalog items with rough
// dimensions, generate a full quotation in one action.
//
// Product flow (owner-side, session 2026-08-14):
//   dashboard → "New Quote" → this page
//     (a) no ?client=  → client picker step
//     (b) ?client=<id> → QuickQuoteBuilder
// The line items auto-create a preliminary MeasurementItem so the
// §0.10 measurement gate is satisfied; a real on-site round can
// supersede them later.

import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getClient, listClients } from "@/modules/clients/queries";
import { listBranches } from "@/modules/branches/queries";
import { scoped } from "@/kernel/db/scoped";
import { QuickQuoteBuilder } from "./_components/QuickQuoteBuilder";
import { ClientPicker } from "./_components/ClientPicker";

export const dynamic = "force-dynamic";

interface SearchParams { client?: string; q?: string }

export default async function QuickQuotePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params   = await searchParams;
  const clientId = params.client?.trim();
  const ctx      = await devContext();

  // Step 1 — no client yet: pick from the client list.
  if (!clientId) {
    const q = params.q?.trim() ?? "";
    const { rows, total } = await listClients(ctx, {
      ...(q && { search: q }),
      page: 1,
      pageSize: 25,
      sort: "recent",
    });
    return (
      <>
        <Topbar
          title="Quick Quote"
          eyebrow={
            q
              ? `${total} match${total === 1 ? "" : "es"} · pick a client to continue`
              : "Pick a client to start"
          }
        />
        <ClientPicker rows={rows} q={q} />
      </>
    );
  }

  // Step 2 — client chosen: existing builder flow.
  const client = await getClient(ctx, clientId);
  if (!client) notFound();

  const [branches, projects] = await Promise.all([
    listBranches(ctx),
    scoped(ctx).project.findMany({
      where:   { clientId },
      orderBy: { createdAt: "desc" },
      select:  { id: true, name: true, number: true },
      take:    20,
    }),
  ]);

  return (
    <>
      <Topbar
        title="Quick Quote"
        eyebrow={`${client.name} · ${client.mobile}${client.email ? ` · ${client.email}` : ""}`}
      />
      <QuickQuoteBuilder
        clientId={client.id}
        clientName={client.name}
        branches={branches}
        projects={projects}
      />
    </>
  );
}
