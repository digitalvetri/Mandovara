import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listBrandsForPicker } from "@/modules/products/queries";
import { ProductForm } from "../_components/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const ctx = await devContext();
  const brands = await listBrandsForPicker(ctx);
  return (
    <>
      <Topbar
        title="New product"
        eyebrow="Category picks a family. Brand is created inline if new."
      />
      <ProductForm mode="create" brands={brands} />
    </>
  );
}
