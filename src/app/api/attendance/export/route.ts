// Monthly attendance export for payroll (owner, 2026-08-29).
//
// One row per employee per day, which is the shape a payroll clerk
// reconciles against — not a summary, because the argument at month end
// is always about a specific day.

import { NextResponse } from "next/server";
import { devContext } from "@/lib/dev-context";
import { requirePermission } from "@/kernel/rbac/guard";
import { scoped } from "@/kernel/db/scoped";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function hhmm(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata",
  });
}

export async function GET(req: Request) {
  const ctx = await devContext();
  requirePermission(ctx, "attendance.view");

  const url = new URL(req.url);
  const raw = url.searchParams.get("month") ?? "";
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  const now = new Date();
  const year  = m ? Number(m[1]) : now.getUTCFullYear();
  const month = m ? Number(m[2]) : now.getUTCMonth() + 1;

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 1));

  const db = scoped(ctx);
  const [rows, employees] = await Promise.all([
    db.attendance.findMany({
      where:   { date: { gte: start, lt: end } },
      select:  { employeeId: true, date: true, status: true, inAt: true, outAt: true, lockedAt: true },
      orderBy: [{ date: "asc" }],
    }),
    db.employee.findMany({ select: { id: true, name: true, code: true, department: true } }),
  ]);
  const emp = new Map(employees.map((e) => [e.id, e]));

  const header = ["Employee Code", "Employee", "Department", "Date", "In", "Out", "Status", "Locked"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((r) => {
      const e = emp.get(r.employeeId);
      return [
        csvCell(e?.code ?? ""),
        csvCell(e?.name ?? r.employeeId),
        csvCell(e?.department ?? ""),
        csvCell(r.date.toISOString().slice(0, 10)),
        csvCell(hhmm(r.inAt)),
        csvCell(hhmm(r.outAt)),
        csvCell(r.status),
        csvCell(r.lockedAt ? "Yes" : "No"),
      ].join(",");
    }),
  ];

  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${year}-${String(month).padStart(2, "0")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
