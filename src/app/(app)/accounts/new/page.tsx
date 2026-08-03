import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listClientsWithOutstanding } from "@/modules/receipts/queries";
import { listBranches } from "@/modules/branches/queries";
import { ReceiptRecorder } from "../_components/ReceiptRecorder";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage() {
  const ctx = await devContext();
  const [clients, branches] = await Promise.all([
    listClientsWithOutstanding(ctx),
    listBranches(ctx),
  ]);
  return (
    <>
      <Topbar
        title="Record receipt"
        eyebrow="One receipt can settle multiple invoices. Any residual stays on account."
      />
      <ReceiptRecorder clients={clients} branches={branches} />
    </>
  );
}
