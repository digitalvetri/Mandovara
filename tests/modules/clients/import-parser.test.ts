// End-to-end parse of a workbook shaped like a real business export —
// inconsistent headers, mixed formats, and the mistakes people make.
//
// Built in-memory with SheetJS rather than checked in as a fixture, so
// the messy cases are readable here rather than hidden inside a binary.

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseMigrationWorkbook } from "@/modules/clients/import-parser";

function workbook(sheets: Record<string, Record<string, unknown>[]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseMigrationWorkbook — a realistic messy export", () => {
  const buf = workbook({
    Clients: [
      // Headers as a person would write them, not as we'd like them.
      { "Client Code": "C-1042", "Client Name": "Dr Kannan", "Mobile No": "98430 12345",
        "Type": "Homeowner", "City": "Coimbatore" },
      { "Client Code": "C-1043", "Client Name": "Vaastu Architects", "Mobile No": "+91-9000011111",
        "Type": "Architect", "GSTIN": "33AABCU9603R1ZX", "City": "Coimbatore" },
      // Their word, not our enum.
      { "Client Code": "C-1044", "Client Name": "Sri Builders", "Mobile No": "09843099999",
        "Type": "Contractor", "City": "Tiruppur" },
    ],
    Projects: [
      { "Project Name": "Dr Kannan — Villa", "Client Code": "C-1042",
        "Stage": "Completed", "Order Value": "6,50,000", "Date": "14/03/2026" },
      // Referenced by mobile instead of code — books do both.
      { "Project Name": "Vaastu — Office", "client_mobile": "9000011111",
        "Stage": "Ordered", "Order Value": "2.4L", "Date": "02/07/2026" },
    ],
  });

  const res = parseMigrationWorkbook(buf);

  it("reads every client despite the header styling", () => {
    expect(res.clients).toHaveLength(3);
    expect(res.clients.map((c) => c.name)).toEqual([
      "Dr Kannan", "Vaastu Architects", "Sri Builders",
    ]);
  });

  it("normalises every mobile to one canonical form", () => {
    expect(res.clients.map((c) => c.mobile)).toEqual([
      "+919843012345", "+919000011111", "+919843099999",
    ]);
  });

  it("maps their vocabulary onto our types", () => {
    expect(res.clients[2]!.type).toBe("BUILDER");   // "Contractor"
    expect(res.clients[1]!.type).toBe("ARCHITECT");
  });

  it("reads amounts in both grouping and shorthand", () => {
    expect(res.projects[0]!.orderValuePaise).toBe(65_000_000n);   // 6,50,000
    expect(res.projects[1]!.orderValuePaise).toBe(24_000_000n);   // 2.4L
  });

  it("reads dd/mm/yyyy the Indian way", () => {
    expect(res.projects[0]!.startedOn?.getUTCMonth()).toBe(2);  // March
    expect(res.projects[0]!.startedOn?.getUTCDate()).toBe(14);
  });

  it("accepts a project referenced by code or by mobile", () => {
    expect(res.projects[0]!.clientRef).toBe("C-1042");
    expect(res.projects[1]!.clientRef).toBe("9000011111");
  });

  it("parses cleanly", () => {
    expect(res.errors).toHaveLength(0);
  });
});

describe("parseMigrationWorkbook — the mistakes people make", () => {
  it("names the row and the reason, never just 'invalid'", () => {
    const res = parseMigrationWorkbook(workbook({
      Clients: [
        { name: "No Mobile Person", city: "Coimbatore" },
        { name: "Bad Number", mobile: "12345" },
        { name: "Landline Person", mobile: "0422 2345678" },
      ],
    }));
    expect(res.clients).toHaveLength(0);
    expect(res.errors).toHaveLength(3);
    expect(res.errors[0]!.row).toBe(1);
    expect(res.errors[0]!.reason).toMatch(/required/i);
    expect(res.errors[1]!.reason).toMatch(/not a 10-digit/i);
    // A landline is not a mobile — it cannot receive the WhatsApp quote.
    expect(res.errors[2]!.reason).toMatch(/not a 10-digit/i);
  });

  it("catches the same client entered twice and points at the first row", () => {
    // Two rows, one person. Importing both splits their projects across
    // two client records, which is very hard to unpick afterwards.
    const res = parseMigrationWorkbook(workbook({
      Clients: [
        { name: "Dr Kannan", mobile: "9843012345" },
        { name: "Dr. Kannan", mobile: "+91 98430 12345" },
      ],
    }));
    expect(res.clients).toHaveLength(1);
    expect(res.errors[0]!.reason).toMatch(/same mobile as row 1/i);
  });

  it("rejects a malformed GSTIN rather than storing it", () => {
    const res = parseMigrationWorkbook(workbook({
      Clients: [{ name: "X", mobile: "9843012345", gstin: "NOTAGSTIN" }],
    }));
    expect(res.errors[0]!.field).toBe("gstin");
  });

  it("requires a client reference on every project", () => {
    const res = parseMigrationWorkbook(workbook({
      Projects: [{ project_name: "Orphan job", stage: "Completed" }],
    }));
    expect(res.projects).toHaveLength(0);
    expect(res.errors[0]!.reason).toMatch(/needs a client/i);
  });

  it("explains itself when the sheets are named something else", () => {
    const res = parseMigrationWorkbook(workbook({ Sheet1: [{ a: 1 }] }));
    expect(res.errors[0]!.reason).toMatch(/no "clients" or "projects" sheet/i);
  });

  it("does not throw on a file that is not a workbook", () => {
    const res = parseMigrationWorkbook(Buffer.from("this is not an xlsx"));
    expect(res.clients).toHaveLength(0);
    expect(res.errors).toHaveLength(1);
  });

  it("keeps the good rows when only some are bad", () => {
    // Partial success is the whole point — a migration that refuses
    // everything because 2 rows of 1,000 are messy never completes.
    const res = parseMigrationWorkbook(workbook({
      Clients: [
        { name: "Good One", mobile: "9843012345" },
        { name: "Bad One",  mobile: "nope" },
        { name: "Good Two", mobile: "9843012399" },
      ],
    }));
    expect(res.clients).toHaveLength(2);
    expect(res.errors).toHaveLength(1);
  });
});
