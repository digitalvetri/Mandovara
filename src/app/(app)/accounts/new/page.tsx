import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import {
  listClientsWithOutstanding,
  listOutstandingInvoicesForClient,
  listOpenProjectsForClient,
} from "@/modules/receipts/queries";
import { listBranches } from "@/modules/branches/queries";
import { PaymentSheet } from "../_components/PaymentSheet";
import type { OutstandingInvoiceWire, OpenProjectWire } from "../_components/_receipt-primitives";

export const dynamic = "force-dynamic";

interface SearchParams { clientId?: string }

export default async function NewReceiptPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const { clientId } = await searchParams;
  const ctx = await devContext();

  // Pre-load the pre-selected client's jobs and bills so the sheet opens
  // with a target chosen and the amount prefilled (no client-side round-trip
  // on first paint).
  const [clients, branches, outstanding, openProjects] = await Promise.all([
    listClientsWithOutstanding(ctx),
    listBranches(ctx),
    clientId ? listOutstandingInvoicesForClient(ctx, clientId) : Promise.resolve([]),
    clientId ? listOpenProjectsForClient(ctx, clientId)        : Promise.resolve([]),
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

  const initialProjects: OpenProjectWire[] = openProjects.map((p) => ({
    id:              p.id,
    number:          p.number,
    name:            p.name,
    quotationNumber: p.quotationNumber,
    agreedValue:     p.agreedValue.toString(),
    received:        p.received.toString(),
    due:             p.due.toString(),
  }));

  return (
    <>
      <Topbar
        title="Record payment"
        eyebrow="Which job → How much → How paid → Save."
      />
      <PaymentSheet
        clients={clients}
        branches={branches}
        initialClientId={clientId}
        initialOutstanding={clientId ? initialOutstanding : undefined}
        initialProjects={clientId ? initialProjects : undefined}
      />
    </>
  );
}
