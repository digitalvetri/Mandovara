import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listCategories } from "@/modules/products/queries";
import { ProductForm } from "../_components/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const ctx = await devContext();
  const categories = await listCategories(ctx);
  return (
    <>
      <Topbar
        title="New product"
        eyebrow="One SKU. Category is created inline if new."
      />
      <ProductForm mode="create" categories={categories} />
    </>
  );
}
