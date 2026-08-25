// Owner asked (25 Aug 2026, Batch A) for Order to disappear from the
// UI entirely — the project's own 6-phase stepper carries the whole
// workflow. /orders now redirects to /projects. The internal Order
// rows still exist as joins for procurement / make / invoicing.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OrdersListPage() {
  redirect("/projects");
}
