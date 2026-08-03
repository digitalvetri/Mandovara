import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listBranches } from "@/modules/branches/queries";
import { LeadForm } from "../_components/LeadForm";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const ctx = await devContext();
  const branches = await listBranches(ctx);

  return (
    <>
      <Topbar title="New lead" eyebrow="Capture the enquiry — details flow into the pipeline." />
      <LeadForm mode="create" branches={branches} />
    </>
  );
}
