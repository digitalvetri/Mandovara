import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface VendorBillRow {
  id:             string;
  number:         string;
  grnId:          string | null;
  vendorInvoiceNo: string | null;
  billDate:       Date;
  status:         string;
  taxableAmount:  bigint;
  total:          bigint;
}

export interface GRNLineForBilling {
  colourwayId:   string;
  colourwayCode: string;
  colourName:    string;
  quantity:      string;  // Decimal.toString()
  unit:          string;
  ratePaise:     string;  // BigInt.toString(); client uses BigInt(ratePaise) — never parseINR
  gstRate:       number;  // integer %
}

export interface GRNForBilling {
  id:         string;
  number:     string;
  receivedAt: Date;
  invoiceRef: string | null;
  lines:      GRNLineForBilling[];
}

export async function listVendorBillsForPO(
  ctx: RequestContext,
  poId: string,
): Promise<VendorBillRow[]> {
  requirePermission(ctx, "po.view");
  const db = scoped(ctx);
  return db.vendorBill.findMany({
    where:   { purchaseOrderId: poId },
    orderBy: { billDate: "desc" },
    select:  {
      id: true, number: true, grnId: true, vendorInvoiceNo: true,
      billDate: true, status: true, taxableAmount: true, total: true,
    },
  });
}

export async function getGRNsForBilling(
  ctx: RequestContext,
  poId: string,
): Promise<GRNForBilling[]> {
  requirePermission(ctx, "po.view");
  const db = scoped(ctx);

  // GRN ids already covered by a non-cancelled bill
  const existingBills = await db.vendorBill.findMany({
    where:  { purchaseOrderId: poId, status: { not: "CANCELLED" } },
    select: { grnId: true },
  });
  const billedGrnIds = new Set(
    existingBills.map((b) => b.grnId).filter((id): id is string => id !== null),
  );

  const [grns, poLines] = await Promise.all([
    db.gRN.findMany({
      where:   { purchaseOrderId: poId },
      orderBy: { receivedAt: "desc" },
      select: {
        id: true, number: true, receivedAt: true, invoiceRef: true,
        lines: { select: { colourwayId: true, quantity: true, rate: true } },
      },
    }),
    db.pOLine.findMany({
      where:  { purchaseOrderId: poId },
      select: { colourwayId: true, unit: true, gstRate: true },
    }),
  ]);

  const unitByCw   = new Map(poLines.map((l) => [l.colourwayId, l.unit as string]));
  const gstByCw    = new Map(poLines.map((l) => [l.colourwayId, Number(l.gstRate)]));

  const allCwIds   = [...new Set(grns.flatMap((g) => g.lines.map((l) => l.colourwayId)))];
  const colourways = allCwIds.length
    ? await db.colourway.findMany({
        where:  { id: { in: allCwIds } },
        select: { id: true, code: true, colourName: true },
      })
    : [];
  const cwMap = new Map(colourways.map((c) => [c.id, c]));

  return grns
    .filter((g) => !billedGrnIds.has(g.id))
    .map((g) => ({
      id:         g.id,
      number:     g.number,
      receivedAt: g.receivedAt,
      invoiceRef: g.invoiceRef ?? null,
      lines:      g.lines.map((l) => {
        const cw = cwMap.get(l.colourwayId);
        return {
          colourwayId:   l.colourwayId,
          colourwayCode: cw?.code        ?? l.colourwayId.slice(0, 8),
          colourName:    cw?.colourName  ?? "—",
          quantity:      l.quantity.toString(),
          unit:          unitByCw.get(l.colourwayId) ?? "METRE",
          ratePaise:     l.rate.toString(),
          gstRate:       gstByCw.get(l.colourwayId)  ?? 0,
        };
      }),
    }));
}
