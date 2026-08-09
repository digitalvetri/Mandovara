import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listBranches } from "@/modules/branches/queries";
import { QuotationBuilder } from "../_components/QuotationBuilder";

export const dynamic = "force-dynamic";

interface SearchParams {
  project?: string;
}

export default async function NewQuotationPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();
  const branches = await listBranches(ctx);
  const projectId = params.project?.trim() ?? "";

  return (
    <>
      <Topbar
        title="New Quotation"
        eyebrow={projectId ? `Project ${projectId}` : "Select a project first"}
      />
      <QuotationBuilder projectId={projectId} branches={branches} />
    </>
  );
}
