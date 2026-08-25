import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { getGRNsForBilling } from "@/modules/purchase/vendor-bill-queries";
import { VendorBillForm } from "./_components/VendorBillForm";

export const dynamic = "force-dynamic";

export default async function NewVendorBillPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const db  = scoped(ctx);

  const po = await db.purchaseOrder.findUnique({
    where:  { id },
    select: { id: true, number: true, status: true, vendorId: true },
  });
  if (!po) notFound();

  const billableStatuses = ["PARTIAL", "RECEIVED", "CANCELLED"] as string[];
  if (!billableStatuses.includes(po.status)) redirect(`/purchase/${id}`);

  const [grns, vendor] = await Promise.all([
    getGRNsForBilling(ctx, id),
    db.vendor.findUnique({ where: { id: po.vendorId }, select: { name: true } }),
  ]);

  const vendorName = vendor?.name ?? "—";

  return (
    <>
      <Topbar
        title="Raise vendor bill"
        eyebrow={`${po.number} · ${vendorName}`}
      />
      <VendorBillForm
        poId={po.id}
        grns={grns}
      />
    </>
  );
}
