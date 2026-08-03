// Serves the "upcoming meetings" list for the calendar popover in the topbar.
// A "meeting" here is a Follow-up entry with a due date in the next 7 days.
// BigInts (none in this response) and Dates → ISO strings.

import { NextResponse } from "next/server";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

export async function GET(): Promise<Response> {
  const ctx = await devContext();
  const db = scoped(ctx);

  const now = new Date();
  const inSevenDays = new Date(); inSevenDays.setDate(now.getDate() + 7);

  const rows = await db.followUp.findMany({
    where: {
      status: { in: ["OPEN", "OVERDUE"] },
      dueAt: { gte: startOfDay(now), lte: inSevenDays },
    },
    orderBy: { dueAt: "asc" },
    take: 8,
    select: {
      id: true, dueAt: true, note: true,
      leadId: true, clientId: true, quotationId: true,
      lead: { select: { name: true } },
    },
  });

  // Batch-resolve client + quotation labels for entries that need them.
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((x): x is string => !!x))];
  const quotationIds = [...new Set(rows.map((r) => r.quotationId).filter((x): x is string => !!x))];
  const [clients, quotations] = await Promise.all([
    clientIds.length
      ? db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    quotationIds.length
      ? db.quotation.findMany({ where: { id: { in: quotationIds } }, select: { id: true, number: true } })
      : Promise.resolve([]),
  ]);
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  const quoMap    = new Map(quotations.map((q) => [q.id, q.number]));

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id,
      dueAt: r.dueAt.toISOString(),
      note: r.note ?? "",
      subject:
        r.lead?.name ??
        (r.clientId    ? clientMap.get(r.clientId) : null) ??
        (r.quotationId ? quoMap.get(r.quotationId) : null) ??
        "General",
      kind: r.leadId ? "LEAD" : r.clientId ? "CLIENT" : r.quotationId ? "QUOTE" : "OPEN",
    })),
  });
}

function startOfDay(d: Date): Date {
  const c = new Date(d); c.setHours(0, 0, 0, 0); return c;
}
