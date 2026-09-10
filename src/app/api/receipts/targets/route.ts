// What one client's money can be put against: their open jobs and their
// open bills, in a single round-trip.
//
// The payment sheet used to fetch bills alone. Under the quotation-first
// flow most clients have none — the studio invoices at the end of a job —
// so the sheet had nothing to offer and every advance was recorded with
// nothing attached to it. That is the "not matched to a bill" pile.
//
// BigInts are serialised as decimal strings so JSON.parse doesn't choke.

import { NextResponse } from "next/server";
import { devContext } from "@/lib/dev-context";
import {
  listOutstandingInvoicesForClient,
  listOpenProjectsForClient,
} from "@/modules/receipts/queries";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  const ctx = await devContext();
  const [bills, projects] = await Promise.all([
    listOutstandingInvoicesForClient(ctx, clientId),
    listOpenProjectsForClient(ctx, clientId),
  ]);

  return NextResponse.json({
    bills: bills.map((r) => ({
      id: r.id,
      number: r.number,
      date: r.date.toISOString(),
      dueDate: r.dueDate.toISOString(),
      total: r.total.toString(),
      paidTotal: r.paidTotal.toString(),
      advanceAdjusted: r.advanceAdjusted.toString(),
      outstanding: r.outstanding.toString(),
    })),
    projects: projects.map((p) => ({
      id:              p.id,
      number:          p.number,
      name:            p.name,
      quotationNumber: p.quotationNumber,
      agreedValue:     p.agreedValue.toString(),
      received:        p.received.toString(),
      due:             p.due.toString(),
    })),
  });
}
