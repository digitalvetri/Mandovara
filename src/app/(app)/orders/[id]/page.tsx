// Owner asked (25 Aug 2026) for the internal Order record to be
// invisible in the UI — the project's own 5-phase stepper covers what
// the client cares about, and duplicate stepper (Confirmed → Procurement
// → Make → Completed) on this page was confusing.
//
// The Order row itself still exists — it's the join between an accepted
// firm quotation and downstream ops (procurement, make, invoicing).
// Anyone who lands here (old bookmark, notification link) gets sent
// straight to the project detail, which is the sanctioned view.

import { redirect, notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { getOrder } from "@/modules/orders/queries";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const o = await getOrder(ctx, id);
  if (!o) notFound();

  redirect(`/projects/${o.projectId}`);
}
