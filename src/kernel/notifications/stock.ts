// Low-stock notification listener.
//
// Subscribes to `stock.belowReorder` events (emitted by inventory
// adjustStock / setReorderLevel and, in future, by the allocation
// flow when material is issued). For each event, creates one
// in-app Notification per user with role STORE or OWNER in the org.
//
// Registered from kernel/events/register.ts alongside the other
// domain listeners; the module-scoped `registered` flag guards
// against double-firing under HMR.

import { orgPrisma } from "@/kernel/db/rls";
import { bus } from "@/kernel/events/bus";
import type { StockBelowReorderEvent } from "@/kernel/events/types";

async function onStockBelowReorder(e: StockBelowReorderEvent): Promise<void> {
  // Look up the SKU so the notification body is human-readable.
  const cw = await orgPrisma(e.orgId).colourway.findUnique({
    where:  { id: e.productId },
    select: {
      code: true, colourName: true,
      design: { select: { name: true } },
    },
  });
  const label = cw
    ? `${cw.design.name} — ${cw.colourName} (${cw.code})`
    : `SKU ${e.productId}`;

  // Everyone who cares: STORE (primary), OWNER (visibility).
  const recipients = await orgPrisma(e.orgId).user.findMany({
    where:  { organizationId: e.orgId, role: { in: ["STORE", "OWNER"] }, status: "ACTIVE" },
    select: { id: true },
  });

  if (recipients.length === 0) return;

  await orgPrisma(e.orgId).notification.createMany({
    data: recipients.map((u) => ({
      organizationId: e.orgId,
      userId:         u.id,
      title:          "Stock below reorder level",
      body:           `${label} is at ${e.currentQty} (reorder at ${e.reorderLevel}). Raise a PO.`,
      refType:        "COLOURWAY",
      refId:          e.productId,
      channels:       ["IN_APP"],
    })),
  });
}

let registered = false;
export function registerStockNotificationListeners(): void {
  if (registered) return;
  registered = true;
  bus.subscribe("stock.belowReorder", onStockBelowReorder);
}
