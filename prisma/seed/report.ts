import { PrismaClient } from "@prisma/client";

// Row-count report for the Phase 3 gate.
// Lists all 62 Mandovara models from CLAUDE.md §5.
const MODELS = [
  "organization","branch","user","employee",
  "brand","collection","design","colourway","price","serviceRate",
  "sampleBook","sampleIssue",
  "lead","client","contactPerson","architect","architectCommission",
  "project","room","measurement","measurementItem","calcResult",
  "quotation","quotationLine",
  "order","orderLine",
  "vendor","purchaseOrder","pOLine","gRN","gRNLine",
  "stockBalance","stockMove","allocation",
  "makeJob","makeJobLine",
  "installCrew","installVisit","installLine","snag",
  "invoice","invoiceLine","advance","receipt","receiptAllocation",
  "projectExpense","expense",
  "attendance","leave","statutorySlab","payrollRun","payslip",
  "messageTemplate","automationLog","whatsAppConversation","automationRule","followUp",
  "projectDocument","numberSequence","auditLog","savedView","setting",
] as const;

export async function printRowCounts(db: PrismaClient): Promise<void> {
  const rows: { model: string; count: number }[] = [];
  for (const m of MODELS) {
    const delegate = (db as unknown as Record<string, { count: () => Promise<number> }>)[m];
    if (!delegate || typeof delegate.count !== "function") continue;
    try { rows.push({ model: m, count: await delegate.count() }); }
    catch { /* model not present or inaccessible — skip */ }
  }
  const total = rows.reduce((s, r) => s + r.count, 0);
  const width = Math.max(...rows.map((r) => r.model.length));
  process.stdout.write("\n" + "═".repeat(60) + "\n");
  process.stdout.write("  MANDOVARA SEED · ROW COUNTS\n");
  process.stdout.write("═".repeat(60) + "\n");
  for (const r of rows) {
    process.stdout.write("  " + r.model.padEnd(width + 4) + String(r.count).padStart(8) + "\n");
  }
  process.stdout.write("─".repeat(60) + "\n");
  process.stdout.write("  " + "TOTAL".padEnd(width + 4) + String(total).padStart(8) + "\n");
  process.stdout.write("  " + "MODELS COUNTED".padEnd(width + 4) + String(rows.length).padStart(8) + "\n");
  process.stdout.write("═".repeat(60) + "\n");
}
