import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getVendor } from "@/modules/vendors/queries";
import { getVendorLedger } from "@/modules/purchase/vendor-ledger";
import { VendorLedgerPanel } from "./_components/VendorLedgerPanel";
import { VendorForm } from "../_components/VendorForm";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const v = await getVendor(ctx, id);
  if (!v) notFound();

  const ledger = await getVendorLedger(ctx, id);
  return (
    <>
      <Topbar
        title={v.name}
        eyebrow={`${v.code} · ${v.mobile} · ${v.paymentTermsDays}d terms · ${v.leadTimeDays}d lead time`}
      />
      {/* The ledger sits above the edit form: the reason you open a
          vendor is almost always to see what you owe them, not to change
          their phone number. */}
      {ledger && <div className="mb-5"><VendorLedgerPanel ledger={ledger} /></div>}

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
