// Pure Excel parser for the client + project migration import.
//
// This is how ten years of Mandovara's books get into the system. Roughly
// 1,000 clients and 1,200 projects live in their current spreadsheets;
// without this, staff would have to retype a decade of history, which is
// how a rollout quietly fails — people keep using the old book.
//
// No I/O: takes a Buffer, returns { clients, projects, errors }. Testable
// without a database, which matters because the failure mode that hurts
// is a silently mis-parsed row, not a crash.
//
// Two sheets in one workbook, because that is how a business exports:
//   "Clients"  — one row per customer
//   "Projects" — one row per job, referencing a client by code or mobile
//
// Deliberately forgiving about what it accepts and strict about what it
// reports. Header names are matched case- and space-insensitively; money
// accepts "1,50,000" or "150000"; dates accept Excel serials or text.
// Anything it cannot read becomes a numbered error against the row, never
// a silent default.

import * as XLSX from "xlsx";
import { z } from "zod";
import {
  norm, pick, str, normaliseMobile, parseRupeesToPaise, parseDate,
  TYPE_ALIASES, STAGE_ALIASES,
} from "./import-coerce";
import type {
  ImportError, ValidClientRow, ValidProjectRow, MigrationParseResult,
} from "./import-types";

export type { ImportError, ValidClientRow, ValidProjectRow, MigrationParseResult };


const gstinRe = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function readSheet(wb: XLSX.WorkBook, ...names: string[]): Record<string, unknown>[] | null {
  for (const n of names) {
    const found = wb.SheetNames.find((s) => norm(s) === norm(n));
    if (found) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[found]!, { defval: null, raw: true },
      );
      // Normalise every header once so the rest of the parser can assume
      // snake_case keys regardless of what the export called them.
      return rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) out[norm(k)] = v;
        return out;
      });
    }
  }
  return null;
}

export function parseMigrationWorkbook(buffer: Buffer): MigrationParseResult {
  const errors: ImportError[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return {
      clients: [], projects: [],
      errors: [{ sheet: "-", row: 0, field: "file", reason: "That file could not be read as an Excel workbook." }],
    };
  }

  const clients  = parseClients(readSheet(wb, "Clients", "Client", "Customers"), errors);
  const projects = parseProjects(readSheet(wb, "Projects", "Project", "Jobs"), errors);

  if (clients.length === 0 && projects.length === 0 && errors.length === 0) {
    errors.push({
      sheet: "-", row: 0, field: "file",
      reason: 'No "Clients" or "Projects" sheet found. Download the template and use its sheet names.',
    });
  }
  return { clients, projects, errors };
}

function parseClients(
  rows: Record<string, unknown>[] | null,
  errors: ImportError[],
): ValidClientRow[] {
  if (!rows) return [];
  const out: ValidClientRow[] = [];
  const seenMobile = new Map<string, number>();

  rows.forEach((r, i) => {
    const rowNumber = i + 1;
    const name = str(pick(r, "name", "client_name", "customer_name", "party_name"));
    if (!name) {
      errors.push({ sheet: "Clients", row: rowNumber, field: "name", reason: "Client name is required." });
      return;
    }
    const rawMobile = pick(r, "mobile", "phone", "mobile_no", "phone_no", "contact", "contact_no");
    const mobile = normaliseMobile(rawMobile);
    if (!mobile) {
      errors.push({
        sheet: "Clients", row: rowNumber, field: "mobile",
        reason: rawMobile === null
          ? "Mobile number is required — it is how clients are matched and how staff sign in."
          : `"${String(rawMobile)}" is not a 10-digit Indian mobile number.`,
      });
      return;
    }
    // A duplicate mobile in the same file is almost always the same person
    // entered twice. Report it rather than silently creating two clients
    // whose projects then split between them.
    const prev = seenMobile.get(mobile);
    if (prev !== undefined) {
      errors.push({
        sheet: "Clients", row: rowNumber, field: "mobile",
        reason: `Same mobile as row ${prev} — merge those rows before importing.`,
      });
      return;
    }
    seenMobile.set(mobile, rowNumber);

    const rawType = str(pick(r, "type", "client_type", "category"));
    const type = rawType
      ? (TYPE_ALIASES[rawType.toLowerCase()] ?? null)
      : "HOMEOWNER";
    if (rawType && !type) {
      errors.push({
        sheet: "Clients", row: rowNumber, field: "type",
        reason: `"${rawType}" is not a client type. Use homeowner, architect, designer, builder, commercial, government or dealer.`,
      });
      return;
    }

    const gstin = str(pick(r, "gstin", "gst", "gst_no", "gst_number"));
    if (gstin && !gstinRe.test(gstin.toUpperCase())) {
      errors.push({
        sheet: "Clients", row: rowNumber, field: "gstin",
        reason: `"${gstin}" is not a valid 15-character GSTIN.`,
      });
      return;
    }

    const email = str(pick(r, "email", "email_id", "mail"));
    if (email && !z.string().email().safeParse(email).success) {
      errors.push({ sheet: "Clients", row: rowNumber, field: "email", reason: `"${email}" is not a valid email address.` });
      return;
    }

    out.push({
      rowNumber,
      code:        str(pick(r, "code", "client_code", "customer_code", "id")),
      name,
      mobile,
      email,
      type:        type ?? "HOMEOWNER",
      gstin:       gstin ? gstin.toUpperCase() : null,
      addressLine: str(pick(r, "address", "address_line", "billing_address", "street")),
      city:        str(pick(r, "city", "town", "location")),
      state:       str(pick(r, "state")),
      pincode:     str(pick(r, "pincode", "pin", "postal_code", "zip")),
      notes:       str(pick(r, "notes", "remarks", "comment")),
    });
  });

  return out;
}

function parseProjects(
  rows: Record<string, unknown>[] | null,
  errors: ImportError[],
): ValidProjectRow[] {
  if (!rows) return [];
  const out: ValidProjectRow[] = [];

  rows.forEach((r, i) => {
    const rowNumber = i + 1;
    const name = str(pick(r, "name", "project_name", "job_name", "site_name"));
    if (!name) {
      errors.push({ sheet: "Projects", row: rowNumber, field: "name", reason: "Project name is required." });
      return;
    }

    // A project must attach to a client. Accept either the client's code
    // or their mobile — books use one or the other, rarely both.
    const rawRef = pick(r, "client_code", "client", "customer_code", "client_mobile", "customer_mobile", "mobile");
    const ref = str(rawRef);
    if (!ref) {
      errors.push({
        sheet: "Projects", row: rowNumber, field: "client_code",
        reason: "Every project needs a client — give their client_code or their mobile number.",
      });
      return;
    }

    const rawStage = str(pick(r, "stage", "status", "state"));
    const stage = rawStage ? (STAGE_ALIASES[rawStage.toLowerCase()] ?? null) : "COMPLETED";
    if (rawStage && !stage) {
      errors.push({
        sheet: "Projects", row: rowNumber, field: "stage",
        reason: `"${rawStage}" is not a project stage. Use enquiry, measurement, quotation, ordered, make, completed or cancelled.`,
      });
      return;
    }

    const rawValue = pick(r, "order_value", "value", "amount", "total", "project_value");
    const orderValuePaise = parseRupeesToPaise(rawValue);
    if (rawValue !== null && orderValuePaise === null) {
      errors.push({
        sheet: "Projects", row: rowNumber, field: "order_value",
        reason: `"${String(rawValue)}" is not an amount. Use 150000 or 1,50,000.`,
      });
      return;
    }

    out.push({
      rowNumber,
      name,
      clientRef:   ref,
      stage:       stage ?? "COMPLETED",
      siteCity:    str(pick(r, "city", "site_city", "location")),
      siteAddress: str(pick(r, "address", "site_address", "site")),
      orderValuePaise: orderValuePaise ?? 0n,
      startedOn:   parseDate(pick(r, "date", "start_date", "started_on", "order_date", "created")),
      notes:       str(pick(r, "notes", "remarks", "comment", "description")),
    });
  });

  return out;
}
