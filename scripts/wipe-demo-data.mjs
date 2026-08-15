// Wipe transactional / demo data from the Mandovara database.
//
// KEEPS  (real reference data):
//   Organization · Branch · User · Role · RolePermission · Employee ·
//   Vendor · Brand · Collection · Design · Colourway · Price · ServiceRate ·
//   SampleBook · StatutorySlab · MilestoneTemplate · NumberSequence · Setting ·
//   MessageTemplate · AutomationRule.
//
// TRUNCATES (fake work-history):
//   Leads / Clients (+ ContactPerson) / Architects (+ ArchitectCommission) ·
//   Projects (+ ProjectMember, Room, Milestone, SiteLog, SiteVisit, Task,
//     ProjectDocument, ProjectExpense, Snag) ·
//   Measurements (+ MeasurementItem, CalcResult) ·
//   Quotations (+ QuotationLine) · Orders (+ OrderLine) ·
//   PurchaseOrders (+ POLine, PurchaseRequest, PurchaseRequestLine) ·
//   GRNs (+ GRNLine) · Stock (StockBalance, StockMove, Allocation) ·
//   MakeJobs (+ MakeJobLine) · InstallVisits (+ InstallLine, InstallCrew) ·
//   Invoices (+ InvoiceLine, Advance) · Receipts (+ ReceiptAllocation) ·
//   Expenses · SampleIssues (books stay, issue history goes) ·
//   Attendance / Leave / PayrollRun (+ Payslip) ·
//   AutomationLog · WhatsAppConversation · FollowUp · AuditLog.
//
// CASCADE + child ordering handled by disabling triggers around TRUNCATE
// (StockMove and AuditLog are append-only via triggers — same trick the
// seed uses when it wipes).
//
// Run inside the container:
//   node /app/scripts/wipe-demo-data.mjs
//
// Refuses to run in production unless CONFIRM_WIPE=I_UNDERSTAND is set,
// so an accidental invocation on a live prod DB is a no-op.

import { PrismaClient } from "@prisma/client";

const TABLES_TO_TRUNCATE = [
  // ── CRM: fake customers / referrals ───────────────────────────────
  "ContactPerson",
  "ArchitectCommission",
  "Architect",
  "Lead",
  // Clients last in this group — architects/leads reference them.
  "Client",

  // ── Money history (child rows first) ──────────────────────────────
  "ReceiptAllocation", "Receipt",
  "Advance",
  "InvoiceLine", "Invoice",
  "ProjectExpense", "Expense",

  // ── Project ops ───────────────────────────────────────────────────
  "InstallLine", "InstallVisit", "InstallCrew",
  "MakeJobLine", "MakeJob",
  "Allocation",
  "StockMove", "StockBalance",
  "GRNLine", "GRN",
  "POLine", "PurchaseOrder",
  "PurchaseRequestLine", "PurchaseRequest",
  "OrderLine", "Order",
  "QuotationLine", "Quotation",
  "CalcResult", "MeasurementItem", "Measurement",
  "ProjectDocument",
  "Snag",
  "SiteLog",
  "Task",
  "Milestone",
  "Room",
  "SiteVisit",
  "ProjectMember",
  "Project",

  // ── Sample book issue-history (books themselves stay) ─────────────
  "SampleIssue",

  // ── HR ops ────────────────────────────────────────────────────────
  "Payslip", "PayrollRun",
  "Leave",
  "Attendance",

  // ── Automation & audit noise ──────────────────────────────────────
  "AutomationLog",
  "WhatsAppConversation",
  "FollowUp",
  "AuditLog",
];

async function main() {
  if (
    process.env["NEXT_PUBLIC_APP_URL"]?.includes("mandovara.com") &&
    process.env["CONFIRM_WIPE"] !== "I_UNDERSTAND"
  ) {
    console.error("wipe-demo-data refused: production URL detected without CONFIRM_WIPE=I_UNDERSTAND");
    process.exit(1);
  }

  const db = new PrismaClient();
  try {
    const before = await countRows(db);
    console.log("Row counts BEFORE wipe:");
    for (const [t, n] of before) console.log(`  ${t.padEnd(24)} ${n}`);

    // Wrap in one big statement so triggers can be temporarily disabled
    // for AuditLog and StockMove without leaving the DB unprotected on
    // failure.
    const list = TABLES_TO_TRUNCATE.map((t) => `"${t}"`).join(", ");
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        ALTER TABLE "AuditLog"  DISABLE TRIGGER USER;
        ALTER TABLE "StockMove" DISABLE TRIGGER USER;
        TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;
        ALTER TABLE "AuditLog"  ENABLE TRIGGER USER;
        ALTER TABLE "StockMove" ENABLE TRIGGER USER;
      END $$;
    `);

    const after = await countRows(db);
    console.log("\nRow counts AFTER wipe:");
    for (const [t, n] of after) console.log(`  ${t.padEnd(24)} ${n}`);

    console.log("\n✓ Demo data removed. Masters, catalog and templates preserved.");
  } finally {
    await db.$disconnect();
  }
}

async function countRows(db) {
  const out = [];
  for (const t of TABLES_TO_TRUNCATE) {
    const rows = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    out.push([t, rows[0]?.n ?? 0]);
  }
  return out;
}

main().catch((err) => {
  console.error("Wipe FAILED:", err?.message ?? err);
  process.exit(1);
});
