import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listVendorsForPicker } from "@/modules/vendors/queries";
import { listColourwaysForPO } from "@/modules/purchase/queries";
import { POBuilder } from "../_components/POBuilder";

export const dynamic = "force-dynamic";

export default async function NewPOPage() {
  const ctx = await devContext();
  const [vendors, colourways] = await Promise.all([
    listVendorsForPicker(ctx),
    listColourwaysForPO(ctx),
  ]);
  return (
    <>
      <Topbar title="New purchase order" />
      <POBuilder vendors={vendors} colourways={colourways} />
    </>
  );
}
