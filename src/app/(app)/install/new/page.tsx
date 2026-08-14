import { devContext } from "@/lib/dev-context";
import { listEligibleOrders, listInstallCrews } from "@/modules/install/queries";
import { NewVisitForm } from "./_components/NewVisitForm";
import { ChevronLeft, Wrench } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewInstallVisitPage() {
  const ctx = await devContext();
  const [orders, crews] = await Promise.all([
    listEligibleOrders(ctx),
    listInstallCrews(ctx),
  ]);

  return (
    <div className="py-6 max-w-2xl space-y-5">
      <Link href="/install" className="flex items-center gap-1 text-[11px] text-text-muted hover:text-gold transition-colors">
        <ChevronLeft size={13} /> All Visits
      </Link>

      <div className="flex items-center gap-3">
        <Wrench size={20} className="text-gold" strokeWidth={1.5} />
        <h1 className="text-[20px] font-display font-semibold text-text">New Installation Visit</h1>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-surface border border-border rounded-lg">
          <Wrench size={36} className="text-text-subtle mb-3" strokeWidth={1.2} />
          <p className="text-[14px] text-text-muted">No eligible orders</p>
          <p className="text-[12px] text-text-subtle mt-1">
            Orders must be Confirmed, In Make, or Ready to Install — and not already have an installation visit.
          </p>
        </div>
      ) : (
        <NewVisitForm orders={orders} crews={crews} />
      )}
    </div>
  );
}
