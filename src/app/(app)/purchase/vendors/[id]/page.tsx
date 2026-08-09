import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getVendor } from "@/modules/vendors/queries";
import { VendorForm } from "../_components/VendorForm";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const v = await getVendor(ctx, id);
  if (!v) notFound();
  return (
    <>
      <Topbar
        title={v.name}
        eyebrow={`${v.code} · ${v.mobile} · ${v.paymentTermsDays}d terms · ${v.leadTimeDays}d lead time`}
      />
      <VendorForm
        mode="edit"
        initial={{
          id: v.id,
          name: v.name,
          mobile: v.mobile.replace(/^\+91/, ""),
          email: v.email ?? "",
          gstin: v.gstin ?? "",
          paymentTermsDays: v.paymentTermsDays,
          leadTimeDays: v.leadTimeDays,
        }}
      />
    </>
  );
}
