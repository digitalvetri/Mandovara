import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listArchitectsForPicker } from "@/modules/architects/queries";
import { ClientForm } from "../_components/ClientForm";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const ctx = await devContext();
  const architects = await listArchitectsForPicker(ctx);
  return (
    <>
      <Topbar
        title="New client"
        eyebrow="GSTIN and PAN are optional — add later once verified."
      />
      <ClientForm mode="create" architects={architects} />
    </>
  );
}
