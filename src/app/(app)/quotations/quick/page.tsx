// Quick quote — start from either a lead or a client, pick catalog
// items with rough dimensions, generate a full quotation in one action.
//
// Product flow:
//   dashboard      → "New Quote" → this page (no query) → client picker
//   client detail  → "Quick Quote" → ?client=<id> → builder (client mode)
//   lead detail    → "Quick Quote" → ?leadId=<id> → builder (lead mode)
//
// Client-scoped: line items auto-create a preliminary MeasurementItem
// so the §0.10 measurement gate is satisfied. Lead-scoped: skips the
// measurement round entirely — a real on-site round supersedes at
// conversion time.

import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getClient, listClients } from "@/modules/clients/queries";
import { listBranches } from "@/modules/branches/queries";
import { scoped } from "@/kernel/db/scoped";
import { QuickQuoteBuilder } from "./_components/QuickQuoteBuilder";
import { ClientPicker } from "./_components/ClientPicker";

export const dynamic = "force-dynamic";

interface SearchParams { client?: string; leadId?: string; q?: string }

export default async function QuickQuotePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params   = await searchParams;
  const clientId = params.client?.trim();
  const leadId   = params.leadId?.trim();
  const ctx      = await devContext();

  // ── Lead-scoped path (FIXES-01 §5.1) ─────────────────────────
  if (leadId) {
    const lead = await scoped(ctx).lead.findUnique({
      where:  { id: leadId },
      select: { id: true, name: true, mobile: true, email: true, stage: true },
    });
    if (!lead) notFound();
    const branches = await listBranches(ctx);
    return (
      <>
        <Topbar
          title="Quick Quote (lead)"
          eyebrow={`${lead.name} · ${lead.mobile}${lead.email ? ` · ${lead.email}` : ""} · stays a lead until you convert`}
        />
        <QuickQuoteBuilder
          leadId={lead.id}
          clientName={lead.name}
          branches={branches}
          projects={[]}
        />
      </>
    );
  }

  // ── Client-picker step ───────────────────────────────────────
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

  // ── Client-scoped builder ────────────────────────────────────
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
