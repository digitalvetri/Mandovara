import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { listBranches } from "@/modules/branches/queries";
import { listItemsForFirmQuote } from "@/modules/measurement/queries-firm-quote";
import { QuotationBuilder } from "../_components/QuotationBuilder";

export const dynamic = "force-dynamic";

interface SearchParams {
  project?: string;
  lead?: string;
}

export default async function NewQuotationPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();
  const db = scoped(ctx);

  const projectId = params.project?.trim() ?? "";
  const leadId    = params.lead?.trim() ?? "";

  // Fetch lead name for display when creating a lead-scoped quotation
  let leadName = "";
  if (leadId) {
    const lead = await db.lead.findUnique({
      where:  { id: leadId },
      select: { name: true },
    });
    if (!lead) notFound();
    leadName = lead.name;
  }

  // Fetch project name + preload measurement items for firm-quote build.
  // Owner canonical flow: firm quote is built by picking a product per
  // approved measurement item. Empty list → builder falls back to blank.
  let projectName = "";
  let preloadedItems = [] as Awaited<ReturnType<typeof listItemsForFirmQuote>>;
  if (projectId) {
    const project = await db.project.findUnique({
      where:  { id: projectId },
      select: { name: true, number: true },
    });
    if (!project) notFound();
    projectName = `${project.number} · ${project.name}`;
    preloadedItems = await listItemsForFirmQuote(ctx, projectId);
  } else if (leadId) {
    // A measured lead builds a FIRM quote from its own approved rounds
    // (owner decision, 2026-08-27). An unmeasured lead preloads nothing
    // and the builder falls back to blank lines — which is exactly the
    // rough estimate it always was.
    preloadedItems = await listItemsForFirmQuote(ctx, { kind: "LEAD", id: leadId });
  }

  const branches = await listBranches(ctx);

  const eyebrow = leadId
    ? `For lead: ${leadName}${preloadedItems.length > 0 ? ` · ${preloadedItems.length} measured item${preloadedItems.length === 1 ? "" : "s"}` : ""}`
    : projectId
      ? projectName
      : "Select a project first";

  return (
    <>
      <Topbar title="New Quotation" eyebrow={eyebrow} />
      <QuotationBuilder
        projectId={projectId || undefined}
        leadId={leadId || undefined}
        leadName={leadName || undefined}
        branches={branches}
        preloadedItems={preloadedItems}
      />
    </>
  );
}
