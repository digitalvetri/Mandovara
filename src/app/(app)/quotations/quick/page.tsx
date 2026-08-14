// Quick quote — start from a client, pick catalog items with rough
// dimensions, generate a full quotation in one action.
//
// Product flow (owner-side, session 2026-08-14):
//   client detail → "New quick quote" → this page → /quotations/[id]
// The line items auto-create a preliminary MeasurementItem so the
// §0.10 measurement gate is satisfied; a real on-site round can
// supersede them later.

import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getClient } from "@/modules/clients/queries";
import { listBranches } from "@/modules/branches/queries";
import { scoped } from "@/kernel/db/scoped";
import { QuickQuoteBuilder } from "./_components/QuickQuoteBuilder";

export const dynamic = "force-dynamic";

interface SearchParams { client?: string }

export default async function QuickQuotePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params   = await searchParams;
  const clientId = params.client?.trim();
  if (!clientId) notFound();

  const ctx      = await devContext();
  const client   = await getClient(ctx, clientId);
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
