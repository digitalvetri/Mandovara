import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listClientsForPicker, listProductsForPicker } from "@/modules/quotations/queries";
import { listBranches } from "@/modules/branches/queries";
import { QuotationBuilder } from "../_components/QuotationBuilder";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const ctx = await devContext();
  const [clients, products, branches] = await Promise.all([
    listClientsForPicker(ctx),
    listProductsForPicker(ctx),
    listBranches(ctx),
  ]);
  return (
    <>
      <Topbar
        title="Quote Builder"
        eyebrow="Create and send client estimates"
      />
      <QuotationBuilder clients={clients} products={products} branches={branches} />
    </>
  );
}
