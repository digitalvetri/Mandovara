// Serves the "upcoming meetings" list for the calendar popover in the topbar.
// FollowUp (CLAUDE.md §5): refType/refId + completedAt (null = open).
// No legacy status/leadId fields.

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
      completedAt: null,
      dueAt: { gte: startOfDay(now), lte: inSevenDays },
    },
    orderBy: { dueAt: "asc" },
    take: 8,
    select: {
      id: true, dueAt: true, note: true, refType: true, refId: true,
    },
  });

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id,
      dueAt: r.dueAt.toISOString(),
      note: r.note,
      subject: r.note,
      kind: r.refType,
    })),
  });
}

function startOfDay(d: Date): Date {
  const c = new Date(d); c.setHours(0, 0, 0, 0); return c;
}
