import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listVendorsForPicker } from "@/modules/vendors/queries";
import { listProductsForAdjustment } from "@/modules/inventory/queries";
import { listProducts } from "@/modules/products/queries";
import { listBranches } from "@/modules/branches/queries";
import { POBuilder } from "../_components/POBuilder";

export const dynamic = "force-dynamic";

export default async function NewPOPage() {
  const ctx = await devContext();
  const [vendors, productList, branches, invProducts] = await Promise.all([
    listVendorsForPicker(ctx),
    listProducts(ctx, { pageSize: 500 }),
    listBranches(ctx),
    listProductsForAdjustment(ctx),
  ]);
  // Merge gstRate from productList onto the inventory picker rows.
  const gstByProduct = new Map(productList.rows.map((p) => [p.id, p.gstRate]));
  const products = invProducts.map((p) => ({ ...p, gstRate: gstByProduct.get(p.id) ?? 18 }));
  return (
    <>
      <Topbar
        title="New purchase order"
        eyebrow="Number and GST are computed on save. Preview updates as you type."
      />
      <POBuilder vendors={vendors} products={products} branches={branches} />
    </>
  );
}
