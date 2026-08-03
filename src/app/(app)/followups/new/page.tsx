import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listLeadsForFollowUp, listClientsForFollowUp } from "@/modules/followups/queries";
import { NewFollowUpForm } from "../_components/NewFollowUpForm";

export const dynamic = "force-dynamic";

export default async function NewFollowUpPage() {
  const ctx = await devContext();
  const [leads, clients] = await Promise.all([
    listLeadsForFollowUp(ctx),
    listClientsForFollowUp(ctx),
  ]);
  return (
    <>
      <Topbar
        title="New follow-up"
        eyebrow="Attach to a lead OR a client. Overdue follow-ups escalate automatically."
      />
      <NewFollowUpForm leads={leads} clients={clients} />
    </>
  );
}
