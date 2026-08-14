// Returns open leads for the calendar's quick-create follow-up picker.

import { NextResponse } from "next/server";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

const OPEN_STAGES = [
  "NEW", "CONTACTED", "QUALIFIED", "MEASUREMENT_SCHEDULED",
  "VISIT_SCHEDULED", "MEASURED", "QUOTED", "NEGOTIATION",
] as const;

export async function GET(): Promise<Response> {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const rows = await db.lead.findMany({
    where:   { stage: { in: [...OPEN_STAGES] } },
    orderBy: { createdAt: "desc" },
    take:    150,
    select:  { id: true, name: true, mobile: true },
  });

  return NextResponse.json({
    rows: rows.map(r => ({
      id:     r.id,
      name:   r.name,
      mobile: r.mobile.replace("+91", ""),
    })),
  });
}
