// /m/install/[visitId] — mobile field surface for an install visit.
//
// Server-renders the initial visit + line snapshot, then hands off
// to the client FieldSurface which owns the outbox + signature +
// online/offline UX. §14 Phase 5 gate: "install visit completes
// offline and syncs with signature." — the FieldSurface enqueues
// signAndCompleteVisit into IndexedDB when offline; the sync loop
// drains it when the connection returns.

import { notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { getInstallVisit } from "@/modules/install/queries";
import { FieldSurface } from "./_components/FieldSurface";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ visitId: string }> }

export default async function FieldInstallVisitPage({ params }: Props) {
  const { visitId } = await params;
  const ctx = await devContext();
  const v = await getInstallVisit(ctx, visitId);
  if (!v) notFound();

  const linesForField = v.lines.map((l) => ({
    id:            l.id,
    roomLabel:     l.roomLabel,
    productName:   l.productName,
    productUom:    l.productUom,
    plannedQty:    l.plannedQty,
    installedQty:  l.installedQty,
    dyeLotUsed:    l.dyeLotUsed,
  }));

  return (
    <FieldSurface
      visit={{
        id:           v.id,
        number:       v.number,
        status:       v.status,
        clientName:   v.clientName,
        clientMobile: v.clientMobile,
        orderNumber:  v.orderNumber,
        hasSignature: v.clientSignatureKey != null,
      }}
      lines={linesForField}
    />
  );
}
