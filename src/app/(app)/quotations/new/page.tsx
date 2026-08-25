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
  }

  const branches = await listBranches(ctx);

  const eyebrow = leadId
    ? `For lead: ${leadName}`
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
