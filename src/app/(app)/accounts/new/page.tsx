import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import {
  listClientsWithOutstanding,
  listOutstandingInvoicesForClient,
} from "@/modules/receipts/queries";
import { listBranches } from "@/modules/branches/queries";
import { PaymentSheet } from "../_components/PaymentSheet";
import type { OutstandingInvoiceWire } from "../_components/_receipt-primitives";

export const dynamic = "force-dynamic";

interface SearchParams { clientId?: string }

export default async function NewReceiptPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const { clientId } = await searchParams;
  const ctx = await devContext();

  // Pre-load outstanding for the pre-selected client so the sheet opens
  // with amount already prefilled (no client-side round-trip on first paint).
  const [clients, branches, outstanding] = await Promise.all([
    listClientsWithOutstanding(ctx),
    listBranches(ctx),
    clientId ? listOutstandingInvoicesForClient(ctx, clientId) : Promise.resolve([]),
  ]);

  const initialOutstanding: OutstandingInvoiceWire[] = outstanding.map((i) => ({
    id:               i.id,
    number:           i.number,
    date:             i.date.toISOString(),
    dueDate:          i.dueDate.toISOString(),
    total:            i.total.toString(),
    paidTotal:        i.paidTotal.toString(),
    advanceAdjusted:  i.advanceAdjusted.toString(),
    outstanding:      i.outstanding.toString(),
  }));

  return (
    <>
      <Topbar
        title="Record payment"
        eyebrow="Amount → How paid → Save. Extra beyond the bills is kept for later."
      />
      <PaymentSheet
        clients={clients}
        branches={branches}
        initialClientId={clientId}
        initialOutstanding={clientId ? initialOutstanding : undefined}
      />
    </>
  );
}
