// The template that tells staff exactly what to put in each column.
//
// Generated rather than checked in as a binary, so the example rows and
// the parser can never drift apart — if a column is renamed here, the
// header aliases in import-coerce are the same edit.
//
// Two sheets, matching parseMigrationWorkbook: "Clients" and "Projects".
// Each carries two example rows, because an empty template with only
// headers leaves people guessing what a "stage" is.

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENTS = [
  {
    client_code: "C-1042", name: "Dr Kannan", mobile: "9843012345",
    email: "kannan@example.com", type: "Homeowner", gstin: "",
    address: "12 Saibaba Colony", city: "Coimbatore", state: "Tamil Nadu",
    pincode: "641011", notes: "Villa — repeat customer",
  },
  {
    client_code: "C-1043", name: "Vaastu Architects", mobile: "+91 90000 11111",
    email: "hello@vaastu.example", type: "Architect", gstin: "33AABCU9603R1ZX",
    address: "5 Thadagam Road", city: "Coimbatore", state: "Tamil Nadu",
    pincode: "641002", notes: "Refers 4-5 projects a year",
  },
];

const PROJECTS = [
  {
    project_name: "Dr Kannan — Villa, Saibaba Colony", client_code: "C-1042",
    stage: "Completed", order_value: "6,50,000", date: "14/03/2026",
    city: "Coimbatore", address: "12 Saibaba Colony",
    notes: "Curtains + wallpaper, 4 rooms",
  },
  {
    project_name: "Vaastu — Office fit-out", client_code: "9000011111",
    stage: "Ordered", order_value: "2.4L", date: "02/07/2026",
    city: "Coimbatore", address: "5 Thadagam Road",
    notes: "Blinds and flooring",
  },
];

export async function GET(): Promise<NextResponse> {
  const ctx = await devContext();
  requirePermission(ctx, "client.create");

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(CLIENTS),  "Clients");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(PROJECTS), "Projects");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Mandovara-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
