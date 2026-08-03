import { PrismaClient } from "@prisma/client";

// Row-count report for the Session 3 gate.
const MODELS = [
  "organization","branch","user","role","rolePermission","userRole","numberingSeries",
  "auditLog","approval",
  "category","specTemplate","product","productPrice","productDocument",
  "warehouse","rack","bin","batch","serialNumber","stockLedgerEntry","stockBalance",
  "stockTransfer","stockAdjustment","stockTake","stockTakeLine",
  "lead","leadActivity","client","contactPerson","address","priceSlab","creditLimit","complaint",
  "vendor","purchaseRequisition","purchaseOrder","pOLine","gRN","gRNLine","vendorPayment",
  "quotation","quotationLine","salesOrder","orderLine","reservation","dispatch","dispatchLine","deliveryChallan",
  "invoice","invoiceLine","receipt","receiptAllocation",
  "project","milestone","task","materialIssue","siteLog","projectExpense","snagItem","handover",
  "advance","payment","expenseHead","expense","pettyCash","employeeAdvance",
  "employee","shift","attendance","leave","leaveBalance","salaryStructure","salaryComponent",
  "payrollRun","payslip","statutorySlab",
  "automationRule","messageTemplate","messageLog","whatsAppConversation","notification","followUp",
  "savedView","setting","importJob","exportJob",
] as const;

export async function printRowCounts(db: PrismaClient) {
  const rows: { model: string; count: number }[] = [];
  for (const m of MODELS) {
    const model = (db as unknown as Record<string, { count: () => Promise<number> }>)[m];
    if (!model || typeof model.count !== "function") continue;
    try { rows.push({ model: m, count: await model.count() }); }
    catch { /* model not present; skip */ }
  }
  const total = rows.reduce((s, r) => s + r.count, 0);
  const width = Math.max(...rows.map((r) => r.model.length));
  process.stdout.write("\n" + "═".repeat(60) + "\n");
  process.stdout.write("  ROW COUNTS\n");
  process.stdout.write("═".repeat(60) + "\n");
  for (const r of rows) {
    process.stdout.write("  " + r.model.padEnd(width + 4) + String(r.count).padStart(8) + "\n");
  }
  process.stdout.write("─".repeat(60) + "\n");
  process.stdout.write("  " + "TOTAL".padEnd(width + 4) + String(total).padStart(8) + "\n");
  process.stdout.write("  " + "MODELS COUNTED".padEnd(width + 4) + String(rows.length).padStart(8) + "\n");
  process.stdout.write("═".repeat(60) + "\n");
}
