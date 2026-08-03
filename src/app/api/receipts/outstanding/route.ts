// Serves the outstanding-invoice list for a client. Used by the receipt
// recorder form to populate its allocation grid without a full page reload.
//
// BigInts are serialised as decimal strings so JSON.parse doesn't choke.

import { NextResponse } from "next/server";
import { devContext } from "@/lib/dev-context";
import { listOutstandingInvoicesForClient } from "@/modules/receipts/queries";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  const ctx = await devContext();
  const rows = await listOutstandingInvoicesForClient(ctx, clientId);
  return NextResponse.json(rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: r.date.toISOString(),
    dueDate: r.dueDate.toISOString(),
    total: r.total.toString(),
    paidTotal: r.paidTotal.toString(),
    advanceAdjusted: r.advanceAdjusted.toString(),
    outstanding: r.outstanding.toString(),
  })));
}
