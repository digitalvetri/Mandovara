import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import {
  listProductsForAdjustment, listWarehouses,
} from "@/modules/inventory/queries";
import { AdjustmentForm } from "../_components/AdjustmentForm";

export const dynamic = "force-dynamic";

export default async function AdjustPage() {
  const ctx = await devContext();
  const [products, warehouses] = await Promise.all([
    listProductsForAdjustment(ctx),
    listWarehouses(ctx),
  ]);
  return (
    <>
      <Topbar
        title="Stock adjustment"
        eyebrow="Single-line +/- against one warehouse. Every movement is ledgered and audited."
      />
      <AdjustmentForm products={products} warehouses={warehouses} />
    </>
  );
}
