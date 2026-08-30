"use server";

// Destructive: wipes ALL transactional data (leads → clients → projects
// → measurements → quotations → orders → invoices → receipts → visits
// → make jobs → POs → GRNs → HR records → audit log).
//
// Preserves, per the owner's instruction (2026-08-30) to clear the demo
// data "except the datas in the Catloug and stock module":
//
//   · catalog — Brand / Collection / Design / Colourway / Price
//   · stock   — StockBalance AND StockMove. The movements used to be
//               wiped while the balances stayed, which left quantities
//               with no working behind them; both survive now.
//   · logins  — User, Role, Branch, Organization, numbering series.
//               Employee rows go, the accounts they point at do not.
//
// Gated on OWNER role at runtime. Uses TRUNCATE ... CASCADE with the
// append-only StockMove trigger disabled for the duration, exactly like
// the vitest fixture in tests/kernel/fixtures.ts.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authBootstrapPrisma } from "@/kernel/db/client";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface WipeResult {
  ok:      boolean;
  wiped?:  string[];
  error?:  string;
}

// Tables to wipe. Order doesn't matter — TRUNCATE CASCADE fires FKs in
// dependency order automatically. Missing a child table just means
// CASCADE will report it as being cleared implicitly. Order this list
// alphabetically for review, not for correctness.
//
// The runtime SQL below skips any name that isn't a live table (see
// information_schema.tables lookup) so a stale entry here fails soft
// instead of aborting the whole wipe.
const TABLES_TO_WIPE = [
  "Advance",
  "Allocation",
  "Architect",
  "ArchitectCommission",
  "AuditLog",
  "AutomationLog",
  "CalcResult",
  "CalendarEvent",
  "ChatChannel",
  "ChatMember",
  "ChatMessage",
  "Client",
  "CommunicationLog",
  "ContactPerson",
  "Document",
  "Expense",
  "FollowUp",
  "GRN",
  "GRNLine",
  "Invoice",
  "InvoiceLine",
  "Lead",
  "MakeJob",
  "MakeJobEvent",
  "MakeJobLine",
  "Measurement",
  "MeasurementItem",
  "Milestone",
  "Notification",
  "Order",
  "OrderLine",
  "Payment",
  "PaymentAllocation",
  "POLine",
  "Project",
  "ProjectDocument",
  "ProjectExpense",
  "ProjectMember",
  "PromiseToPay",
  "PurchaseOrder",
  "PurchaseRequest",
  "PurchaseRequestLine",
  "Quotation",
  "QuotationLine",
  "Receipt",
  "ReceiptAllocation",
  "Room",
  "SampleIssue",
  "SiteLog",
  "SiteVisit",
  // ── HR and vendors ────────────────────────────────────────────────
  // Added 2026-08-30. prisma/seed/masters.ts plants nine standalone
  // demo employees plus user-linked ones, and demo vendors, and none of
  // it was reachable from here — a studio with seven real people was
  // looking at a payroll full of names it had never hired.
  //
  // Listed explicitly rather than left to CASCADE: Attendance, Leave,
  // LeaveBalance and Payslip carry an employeeId COLUMN but no Prisma
  // relation, so there is no database-level foreign key and TRUNCATE
  // Employee CASCADE would leave every one of them behind, orphaned.
  //
  // User is deliberately NOT here. Employee.userId points at User, not
  // the other way round, so clearing employees cannot log anyone out —
  // and deleting a login nobody asked to delete is not recoverable.
  "Attendance",
  "Employee",
  "Leave",
  "LeaveBalance",
  "PayrollRun",
  "Payslip",
  "Vendor",
  "Task",
  "TaskComment",
  "VendorBill",
  "VendorBillLine",
  "WhatsAppConversation",
] as const;

const confirmSchema = z.object({
  confirmPhrase: z.literal("WIPE ALL DATA"),
});

export async function wipeTransactionalData(input: unknown): Promise<WipeResult> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.wipe");   // must be added to OWNER role perms

  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Type exactly "WIPE ALL DATA" to confirm.' };
  }

  const wiped: string[] = [];
  try {
    // Use the unscoped root client so RLS and org filters can't hide
    // rows from us during the wipe. Disable append-only triggers on
    // AuditLog and StockMove so TRUNCATE works.
    // Skip any table name that isn't a live table in the public schema
    // — keeps the wipe robust against schema drift (renamed/removed
    // models don't abort the whole transaction with 42P01).
    await authBootstrapPrisma.$executeRawUnsafe(`
      DO $$ DECLARE t text;
      BEGIN
        ALTER TABLE "AuditLog" DISABLE TRIGGER USER;
        ALTER TABLE "StockMove" DISABLE TRIGGER USER;
        FOREACH t IN ARRAY ARRAY[${TABLES_TO_WIPE.map((n) => `'${n}'`).join(",")}]
        LOOP
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
          ) THEN
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE;', t);
          END IF;
        END LOOP;
        ALTER TABLE "AuditLog" ENABLE TRIGGER USER;
        ALTER TABLE "StockMove" ENABLE TRIGGER USER;
      END $$;
    `);
    wiped.push(...TABLES_TO_WIPE);

    // Reset numbering sequences so document numbers restart at 0001.
    await authBootstrapPrisma.numberSequence.updateMany({ data: { counter: 0 } });

    revalidatePath("/");
    return { ok: true, wiped };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Wipe failed",
    };
  }
}
