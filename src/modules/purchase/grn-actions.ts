"use server";

// GRN receipt action — separated from actions.ts to keep both files under 300 lines.
// Posts a Goods Receipt Note against a PO:
//   • Validates dye lot is present for mandatory families
//   • Matches GRN lines to POLines by colourwayId (FIFO by POLine.id)
//   • Guards against over-receive per line
//   • Increments POLine.receivedQty in the same transaction
//   • Recomputes PO status (PARTIAL or RECEIVED)

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { postGRNSchema } from "./schema";
import { computePOStatus, MANDATORY_DYE_LOT_FAMILIES } from "./lib";
import { postGrnToBalance } from "@/kernel/stock/balance";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function postGRN(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "grn.create");
  const parsed = postGRNSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  // Load PO + lines (no vendor/colourway relations in schema — fetch separately)
  const po = await db.purchaseOrder.findUniqueOrThrow({
    where: { id: d.purchaseOrderId },
    select: {
      id: true, status: true, vendorId: true,
      lines: {
        orderBy: { id: "asc" },   // FIFO: CUIDs are time-sortable
        select: { id: true, colourwayId: true, quantity: true, receivedQty: true, rate: true },
      },
    },
  });

  if (po.status === "CANCELLED" || po.status === "RECEIVED") {
    return { ok: false, error: `PO is ${po.status} and does not permit receipt` };
  }

  // Fetch colourway families for dye-lot check (no relation on POLine in schema)
  const uniqueColourwayIds = [...new Set(d.lines.map((l) => l.colourwayId))];
  const cwFamilies = uniqueColourwayIds.length
    ? await db.colourway.findMany({
        where: { id: { in: uniqueColourwayIds } },
        select: { id: true, design: { select: { family: true } } },
      })
    : [];
  const familyByColourway = new Map(cwFamilies.map((c) => [c.id, c.design.family]));

  // Build colourwayId → POLine(s) map (FIFO order preserved from orderBy id asc)
  const linesByColourway = new Map<string, typeof po.lines>();
  for (const l of po.lines) {
    const bucket = linesByColourway.get(l.colourwayId) ?? [];
    bucket.push(l);
    linesByColourway.set(l.colourwayId, bucket);
  }

  // Validate each GRN input line and resolve FIFO POLine allocations
  const resolvedLines: {
    poLines:      { id: string; qty: Decimal; rateNum: number }[];
    qty:          Decimal;
    dyeLot:       string | null;
    binLocation:  string | null;
    colourwayId:  string;
    rate:         bigint;
    rollCount:    number | null;
    rollLengthsM: number[] | null;
  }[] = [];

  for (let i = 0; i < d.lines.length; i++) {
    const req = d.lines[i]!;
    const matchingPOLines = linesByColourway.get(req.colourwayId);

    if (!matchingPOLines || matchingPOLines.length === 0) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: { [`lines.${i}.colourwayId`]: "Colourway not on this PO" },
      };
    }

    // Dye lot mandatory check
    const family = familyByColourway.get(req.colourwayId);
    const dyeLot = emptyToNull(req.dyeLot);
    if (family && MANDATORY_DYE_LOT_FAMILIES.has(family) && !dyeLot) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: {
          [`lines.${i}.dyeLot`]: `Dye lot is required for ${family.toLowerCase().replace(/_/g, " ")}`,
        },
      };
    }

    // Compute total pending across all matching POLines (FIFO)
    const totalPending = matchingPOLines.reduce(
      (sum, l) => sum.plus(l.quantity.minus(l.receivedQty)),
      new Decimal(0),
    );
    const reqQty = new Decimal(req.quantity);
    if (reqQty.gt(totalPending)) {
      return {
        ok: false,
        error: "Over-receive blocked",
        fieldErrors: {
          [`lines.${i}.quantity`]: `Only ${totalPending.toString()} pending for this colourway`,
        },
      };
    }

    // Distribute quantity FIFO across matching POLines
    let remaining = reqQty;
    const poLinesToUpdate: { id: string; qty: Decimal; rateNum: number }[] = [];
    for (const pl of matchingPOLines) {
      if (remaining.lte(0)) break;
      const available = pl.quantity.minus(pl.receivedQty);
      if (available.lte(0)) continue;
      const take = remaining.lte(available) ? remaining : available;
      poLinesToUpdate.push({ id: pl.id, qty: take, rateNum: Number(pl.rate) });
      remaining = remaining.minus(take);
    }

    resolvedLines.push({
      poLines:      poLinesToUpdate,
      qty:          reqQty,
      dyeLot,
      binLocation:  emptyToNull(req.binLocation),
      colourwayId:  req.colourwayId,
      rate:         matchingPOLines[0]!.rate,
      rollCount:    req.rollCount ?? null,
      rollLengthsM: req.rollLengthsM ?? null,
    });
  }

  // Get branch prefix for GRN number
  const branch = await db.branch.findFirst({
    where: { organizationId: ctx.orgId },
    orderBy: { name: "asc" },
    select: { invoicePrefix: true },
  });
  const prefix = branch?.invoicePrefix ?? "MDV";

  const receivedAt = new Date(d.receivedAt);

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "GRN",
      yymm:   yymmFromDate(receivedAt),
      prefix,
    });

    const grn = await tx.gRN.create({
      data: {
        organizationId:  ctx.orgId,
        number,
        purchaseOrderId: po.id,
        vendorId:        po.vendorId,
        receivedAt,
        invoiceRef:      emptyToNull(d.invoiceRef),
      },
      select: { id: true, number: true },
    });

    // Create GRN lines, ratchet POLine.receivedQty, and update the stock ledger
    for (const rl of resolvedLines) {
      await tx.gRNLine.create({
        data: {
          organizationId: ctx.orgId,
          grnId:          grn.id,
          colourwayId:    rl.colourwayId,
          quantity:       rl.qty,
          rate:           rl.rate,
          ...(rl.dyeLot                  && { dyeLot: rl.dyeLot }),
          ...(rl.binLocation             && { binLocation: rl.binLocation }),
          ...(rl.rollCount != null       && { rollCount: rl.rollCount }),
          ...(rl.rollLengthsM?.length    && { rollLengthsM: rl.rollLengthsM }),
        },
      });

      for (const pl of rl.poLines) {
        await tx.pOLine.update({
          where: { id: pl.id },
          data:  { receivedQty: { increment: pl.qty } },
        });
      }

      // Write GRN_IN StockMove + upsert StockBalance for this lot
      await postGrnToBalance(tx, {
        organizationId: ctx.orgId,
        colourwayId:    rl.colourwayId,
        dyeLot:         rl.dyeLot,
        quantity:       rl.qty,
        rate:           rl.rate,
        grnId:          grn.id,
        createdById:    ctx.userId,
        occurredAt:     receivedAt,
      });
    }

    // Re-fetch all POLines and recompute PO status
    const freshLines = await tx.pOLine.findMany({
      where:  { purchaseOrderId: po.id },
      select: { quantity: true, receivedQty: true },
    });
    const nextStatus = computePOStatus(
      po.status as "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED",
      freshLines,
    );
    if (nextStatus !== po.status) {
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: nextStatus } });
    }

    return grn;
  });

  revalidatePath("/purchase");
  revalidatePath(`/purchase/${po.id}`);
  return { ok: true, data: created };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

function emptyToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}
