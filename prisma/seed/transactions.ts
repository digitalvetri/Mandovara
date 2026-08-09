// 12 months of transaction history + BUILD-SPEC §15 edge cases.
import { Prisma, PrismaClient } from "@prisma/client";
import { STATE_CODES } from "./data";
import { makeRng } from "./rng";
import type { SeedIds } from "./masters";

interface Ctx {
  db: PrismaClient;
  ids: SeedIds;
  clients: { id: string; stateCode: string; type: string; name: string; primaryMobile: string }[];
  productIds: string[];
  productMeta: Map<string, { gstRate: number; costPaise: bigint; mrpPaise: bigint }>;
  rng: ReturnType<typeof makeRng>;
}

function fyLabel(d: Date): string {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`;
}

function computeLine(taxable: bigint, gstRate: number, sameState: boolean) {
  const rate = BigInt(Math.round(gstRate * 100));
  const total = (taxable * rate) / 10_000n;
  return sameState
    ? { cgst: total / 2n, sgst: total - total / 2n, igst: 0n }
    : { cgst: 0n, sgst: 0n, igst: total };
}

interface Model<T> {
  createMany(args: { data: T[]; skipDuplicates?: boolean }): Promise<unknown>;
}

async function batchCreate<T>(model: Model<T>, rows: T[], chunk = 1000): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    await model.createMany({ data: rows.slice(i, i + chunk), skipDuplicates: true });
  }
}

export async function seedTransactions(
  db: PrismaClient,
  ctx: Omit<Ctx, "db" | "rng">,
  seed = 45,
): Promise<void> {
  const rng = makeRng(seed);
  const c: Ctx = { db, ...ctx, rng };
  await seedLeadsAndFollowUps(c);
  await seedGrnAndStock(c);
  await seedQuotationsOrdersInvoicesReceipts(c);
  await seedAttendanceAndPayroll(c);
  await seedMessagesAndNotifications(c);
  await seedEdgeCases(c);
  // Reserve NumberingSeries counters past the seed's highest per
  // (branch, docType, fy). Without this, the first post-seed call to
  // allocateNumber({docType: "INVOICE"|"SALES_ORDER"|"RECEIPT"|...})
  // starts at currentValue=1 and collides with the seed's own row 1.
  // See project memory: project_seed_numbering_bug.
  await reserveNumberingCounters(c);
}

// Scan the highest sequence number the seed wrote per (branch,
// docType, fy) and upsert the matching NumberingSeries row so
// downstream allocateNumber() calls start at the next free slot.
// Only touches docTypes whose action-layer prefix format matches
// what the seed writes (SO, INV, RCPT, GRN). QUOTATION doesn't
// collide (seed uses "QTN" prefix, action uses "QT"); CN uses
// hardcoded EDGE0N suffixes and isn't sequenced.
async function reserveNumberingCounters(c: Ctx): Promise<void> {
  const branchId = c.ids.branchIds[0]!;
  const groups: {
    docType: string;
    prefix:  string;                         // action-side prefix format
    fetch:   () => Promise<{ number: string }[]>;
  }[] = [
    {
      docType: "SALES_ORDER", prefix: "MDV/CBE/SO",
      fetch: () => c.db.salesOrder.findMany({
        where: { orgId: c.ids.orgId, branchId }, select: { number: true },
      }),
    },
    {
      docType: "INVOICE",     prefix: "MDV/CBE/INV",
      fetch: () => c.db.invoice.findMany({
        where: { orgId: c.ids.orgId, branchId }, select: { number: true },
      }),
    },
    {
      docType: "RECEIPT",     prefix: "MDV/CBE/RCPT",
      fetch: () => c.db.receipt.findMany({
        where: { orgId: c.ids.orgId, branchId }, select: { number: true },
      }),
    },
    {
      docType: "GRN",         prefix: "MDV/CBE/GRN",
      fetch: () => c.db.gRN.findMany({
        where: { orgId: c.ids.orgId, branchId }, select: { number: true },
      }),
    },
  ];

  for (const g of groups) {
    const rows = await g.fetch();
    // Bucket rows by fy label parsed out of the "MDV/CBE/<code>/<fy>/<seq>" format.
    const maxByFy = new Map<string, number>();
    for (const r of rows) {
      const parts = r.number.split("/");
      const fy = parts[3];
      const seq = Number(parts[4]);
      if (!fy || !Number.isFinite(seq)) continue;
      const cur = maxByFy.get(fy) ?? 0;
      if (seq > cur) maxByFy.set(fy, seq);
    }
    for (const [fy, maxSeq] of maxByFy) {
      await c.db.numberingSeries.upsert({
        where: {
          orgId_branchId_docType_financialYear: {
            orgId: c.ids.orgId, branchId, docType: g.docType, financialYear: fy,
          },
        },
        update: { currentValue: BigInt(maxSeq) },
        create: {
          orgId: c.ids.orgId, branchId, docType: g.docType,
          financialYear: fy, prefix: g.prefix, padding: 5,
          currentValue: BigInt(maxSeq),
        },
      });
    }
  }
}

// ── LEADS + FOLLOW-UPS ─────────────────────────────────────────
async function seedLeadsAndFollowUps(c: Ctx): Promise<void> {
  const branchId = c.ids.branchIds[0]!;
  const owners = c.ids.userIds;
  const rows: Prisma.LeadCreateManyInput[] = [];
  for (let i = 0; i < 200; i++) {
    const status = c.rng.weighted<Prisma.LeadCreateManyInput["status"]>([
      ["NEW", 20], ["CONTACTED", 15], ["QUALIFIED", 15], ["PROPOSED", 10],
      ["NEGOTIATION", 10], ["WON", 20], ["LOST", 10],
    ]);
    rows.push({
      orgId: c.ids.orgId, branchId,
      name: `Lead ${i + 1}`,
      mobile: `+91${9100000000 + i * 100 + c.rng.int(0, 99)}`,
      companyName: `Prospect ${i + 1}`,
      source: c.rng.pick(["WEBSITE", "REFERRAL", "WHATSAPP", "WALK_IN", "EXHIBITION"] as const),
      status,
      ownerId: owners[c.rng.int(0, owners.length - 1)]!,
      expectedValue: BigInt(c.rng.int(50_000, 5_00_000) * 100),
      requirement: c.rng.pick(["Cement + TMT for 3BHK", "Complete plumbing", "Electrical rewiring", "Tiles for showroom"]),
      lostReason: status === "LOST" ? c.rng.pick(["Price too high", "Timing", "Went with competitor"]) : null,
      createdAt: c.rng.daysAgo(0, 365),
    });
  }
  await c.db.lead.createMany({ data: rows });

  const leads = await c.db.lead.findMany({
    where: { orgId: c.ids.orgId, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSED", "NEGOTIATION"] } },
    select: { id: true, ownerId: true },
  });
  const fu: Prisma.FollowUpCreateManyInput[] = leads.map((l) => ({
    orgId: c.ids.orgId, leadId: l.id,
    ownerId: l.ownerId ?? c.ids.ownerUserId,
    dueAt: c.rng.daysAgo(-14, 3),
    status: c.rng.weighted<Prisma.FollowUpCreateManyInput["status"]>([
      ["OPEN", 70], ["OVERDUE", 20], ["COMPLETED", 10],
    ]),
  }));
  await c.db.followUp.createMany({ data: fu });
}

// ── GRN → STOCK LEDGER ───────────────────────────────────────
async function seedGrnAndStock(c: Ctx): Promise<void> {
  const branchId = c.ids.branchIds[0]!;
  const warehouseId = c.ids.warehouseIds[0]!;
  const grnCount = 400;
  const ledgerRows: Prisma.StockLedgerEntryCreateManyInput[] = [];
  const balances = new Map<string, { qty: number; value: bigint }>();

  for (let i = 0; i < grnCount; i++) {
    const vendorId = c.ids.vendorIds[c.rng.int(0, c.ids.vendorIds.length - 1)]!;
    const occurredAt = c.rng.daysAgo(0, 365);
    const grn = await c.db.gRN.create({
      data: {
        orgId: c.ids.orgId, branchId, vendorId,
        number: `MDV/CBE/GRN/${fyLabel(occurredAt)}/${String(i + 1).padStart(4, "0")}`,
        receivedAt: occurredAt, status: "POSTED", totalValue: 0n,
        invoiceRef: `V-INV-${1000 + i}`,
      },
    });
    const lineCount = c.rng.int(2, 6);
    let grnTotal = 0n;
    const grnLines: Prisma.GRNLineCreateManyInput[] = [];
    for (let j = 0; j < lineCount; j++) {
      const pid = c.productIds[c.rng.int(0, c.productIds.length - 1)]!;
      const qty = c.rng.int(10, 500);
      const meta = c.productMeta.get(pid)!;
      const rate = meta.costPaise;
      const amount = rate * BigInt(qty);
      grnTotal += amount;
      grnLines.push({
        grnId: grn.id, lineNo: j + 1, productId: pid,
        quantity: new Prisma.Decimal(qty), rate, amount, warehouseId,
      });
      ledgerRows.push({
        orgId: c.ids.orgId, warehouseId, productId: pid, direction: "IN",
        quantity: new Prisma.Decimal(qty), rate, refType: "GRN", refId: grn.id, occurredAt,
      });
      const key = `${warehouseId}::${pid}`;
      const b = balances.get(key) ?? { qty: 0, value: 0n };
      balances.set(key, { qty: b.qty + qty, value: b.value + amount });
    }
    await c.db.gRNLine.createMany({ data: grnLines });
    await c.db.gRN.update({ where: { id: grn.id }, data: { totalValue: grnTotal } });
  }

  await batchCreate(c.db.stockLedgerEntry, ledgerRows);

  const balanceRows: Prisma.StockBalanceCreateManyInput[] = [];
  for (const [key, v] of balances) {
    const [wid, pid] = key.split("::");
    balanceRows.push({
      orgId: c.ids.orgId, warehouseId: wid!, productId: pid!,
      quantity: new Prisma.Decimal(v.qty), value: v.value,
    });
  }
  await batchCreate(c.db.stockBalance, balanceRows);
}

// ── QUOTATIONS → SO → INVOICES → RECEIPTS ─────────────────────
async function seedQuotationsOrdersInvoicesReceipts(c: Ctx): Promise<void> {
  const branchId = c.ids.branchIds[0]!;
  const owners = c.ids.userIds;
  const eligible = c.clients.filter((cl) => cl.type !== "RETAIL" || c.rng.boolean(0.5));
  const target = 1500;
  const supplierState = STATE_CODES.TN;

  let qNum = 0, oNum = 0, iNum = 0, rNum = 0;
  const paidQueue: { id: string; total: bigint; date: Date; clientId: string }[] = [];
  const invoiceLines: Prisma.InvoiceLineCreateManyInput[] = [];
  const orderLines: Prisma.OrderLineCreateManyInput[] = [];

  for (let n = 0; n < target; n++) {
    const client = eligible[c.rng.int(0, eligible.length - 1)]!;
    const sameState = client.stateCode === supplierState;
    const date = c.rng.daysAgo(0, 365);
    const fy = fyLabel(date);

    const lineCount = c.rng.int(2, 6);
    const lines: Prisma.QuotationLineCreateWithoutQuotationInput[] = [];
    let qTaxable = 0n, qCgst = 0n, qSgst = 0n, qIgst = 0n;
    for (let j = 0; j < lineCount; j++) {
      const pid = c.productIds[c.rng.int(0, c.productIds.length - 1)]!;
      const meta = c.productMeta.get(pid)!;
      const qty = c.rng.int(1, 20);
      const rate = meta.mrpPaise;
      const taxable = rate * BigInt(qty);
      const tax = computeLine(taxable, meta.gstRate, sameState);
      qTaxable += taxable; qCgst += tax.cgst; qSgst += tax.sgst; qIgst += tax.igst;
      lines.push({
        lineNo: j + 1, product: { connect: { id: pid } }, description: "",
        quantity: new Prisma.Decimal(qty), rate,
        taxable, gstRate: new Prisma.Decimal(meta.gstRate),
        cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst,
        amount: taxable + tax.cgst + tax.sgst + tax.igst,
      });
    }
    const qTotal = qTaxable + qCgst + qSgst + qIgst;

    qNum += 1;
    const quotation = await c.db.quotation.create({
      data: {
        orgId: c.ids.orgId, branchId, clientId: client.id,
        number: `MDV/CBE/QTN/${fy}/${String(qNum).padStart(5, "0")}`,
        date, validUntil: new Date(date.getTime() + 30 * 864e5),
        status: "CONVERTED",
        taxableAmount: qTaxable, cgst: qCgst, sgst: qSgst, igst: qIgst, roundOff: 0n, total: qTotal,
        ownerId: owners[c.rng.int(0, owners.length - 1)]!,
        lines: { create: lines },
      },
    });

    oNum += 1;
    const order = await c.db.salesOrder.create({
      data: {
        orgId: c.ids.orgId, branchId, clientId: client.id, quotationId: quotation.id,
        number: `MDV/CBE/SO/${fy}/${String(oNum).padStart(5, "0")}`,
        date, deliveryBy: new Date(date.getTime() + 7 * 864e5),
        status: "DISPATCHED",
        taxableAmount: qTaxable, cgst: qCgst, sgst: qSgst, igst: qIgst, total: qTotal,
      },
    });

    iNum += 1;
    const inv = await c.db.invoice.create({
      data: {
        orgId: c.ids.orgId, branchId, type: "TAX", clientId: client.id, orderId: order.id,
        number: `MDV/CBE/INV/${fy}/${String(iNum).padStart(5, "0")}`,
        date, dueDate: new Date(date.getTime() + 30 * 864e5),
        placeOfSupply: client.stateCode,
        taxableAmount: qTaxable, cgst: qCgst, sgst: qSgst, igst: qIgst, roundOff: 0n, total: qTotal,
        irnStatus: qTotal > 5_00_000_00n ? "GENERATED" : "NOT_REQUIRED",
        status: "ISSUED",
      },
    });
    paidQueue.push({ id: inv.id, total: qTotal, date, clientId: client.id });

    // Mirror the quotation lines into invoice + order lines (batched at end)
    for (const l of lines) {
      const pid = (l.product as { connect: { id: string } }).connect.id;
      invoiceLines.push({
        invoiceId: inv.id, lineNo: l.lineNo, productId: pid, description: l.description ?? "",
        quantity: l.quantity, rate: l.rate, taxable: l.taxable,
        gstRate: l.gstRate, cgst: l.cgst, sgst: l.sgst, igst: l.igst, amount: l.amount,
      });
      orderLines.push({
        salesOrderId: order.id, lineNo: l.lineNo, productId: pid, description: l.description ?? "",
        orderedQty: l.quantity, dispatchedQty: l.quantity,
        rate: l.rate, gstRate: l.gstRate, amount: l.amount,
      });
    }
  }

  // Bulk insert all invoice + order lines
  await batchCreate(c.db.invoiceLine, invoiceLines);
  await batchCreate(c.db.orderLine, orderLines);

  // Receipts against every third invoice (some partial, some with residual)
  for (let i = 0; i < paidQueue.length; i += 3) {
    const inv = paidQueue[i]!;
    const payFull = c.rng.boolean(0.75);
    const amount = payFull ? inv.total : (inv.total * BigInt(c.rng.int(30, 90))) / 100n;
    rNum += 1;
    const rec = await c.db.receipt.create({
      data: {
        orgId: c.ids.orgId, branchId, clientId: inv.clientId,
        number: `MDV/CBE/RCPT/${fyLabel(inv.date)}/${String(rNum).padStart(5, "0")}`,
        date: new Date(inv.date.getTime() + c.rng.int(3, 25) * 864e5),
        mode: c.rng.pick(["UPI", "NEFT", "RTGS", "CHEQUE"] as const),
        amount, unallocated: 0n,
      },
    });
    await c.db.receiptAllocation.create({
      data: { receiptId: rec.id, invoiceId: inv.id, amount: amount <= inv.total ? amount : inv.total },
    });
  }
}

// ── ATTENDANCE + PAYROLL ─────────────────────────────────────
async function seedAttendanceAndPayroll(c: Ctx): Promise<void> {
  const attendance: Prisma.AttendanceCreateManyInput[] = [];
  const today = new Date();
  for (const empId of c.ids.employeeIds) {
    for (let d = 0; d < 90; d++) {
      const day = new Date(today); day.setDate(today.getDate() - d); day.setHours(0, 0, 0, 0);
      if (day.getDay() === 0) continue;
      const status = c.rng.weighted<Prisma.AttendanceCreateManyInput["status"]>([
        ["PRESENT", 88], ["LEAVE", 6], ["HALF_DAY", 3], ["ABSENT", 3],
      ]);
      attendance.push({
        orgId: c.ids.orgId, employeeId: empId, date: day, status,
        inTime: status === "PRESENT" ? new Date(day.getTime() + 9 * 3600e3) : null,
        outTime: status === "PRESENT" ? new Date(day.getTime() + 18 * 3600e3) : null,
        workedHours: new Prisma.Decimal(status === "PRESENT" ? 8 : status === "HALF_DAY" ? 4 : 0),
      });
    }
  }
  await batchCreate(c.db.attendance, attendance);

  const branchId = c.ids.branchIds[0]!;
  const now = new Date();
  for (let m = 1; m <= 3; m++) {
    const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const run = await c.db.payrollRun.create({
      data: {
        orgId: c.ids.orgId, branchId,
        month: target.getMonth() + 1, year: target.getFullYear(),
        status: "FINALIZED",
        finalizedAt: new Date(target.getFullYear(), target.getMonth() + 1, 1),
      },
    });
    const slips: Prisma.PayslipCreateManyInput[] = [];
    for (const empId of c.ids.employeeIds) {
      const gross = BigInt(Math.floor((c.rng.int(20, 80) * 100_000) * 100 / 12));
      const ded = gross / 10n;
      slips.push({
        orgId: c.ids.orgId, payrollRunId: run.id, employeeId: empId,
        daysWorked: new Prisma.Decimal(26 - c.rng.int(0, 2)),
        daysLOP: new Prisma.Decimal(c.rng.int(0, 2)),
        gross, deductions: ded, net: gross - ded,
        breakup: {
          BASIC: String(gross / 2n), HRA: String(gross / 4n), PF: "21600",
        } as unknown as Prisma.InputJsonValue,
      });
    }
    await c.db.payslip.createMany({ data: slips });
    const totalNet = slips.reduce<bigint>((s, p) => s + BigInt(p.net as bigint), 0n);
    await c.db.payrollRun.update({ where: { id: run.id }, data: { totalPayable: totalNet } });
  }
}

// ── MESSAGES + NOTIFICATIONS ─────────────────────────────────
async function seedMessagesAndNotifications(c: Ctx): Promise<void> {
  const tmpl = await c.db.messageTemplate.create({
    data: {
      orgId: c.ids.orgId, name: "quote_sent", category: "UTILITY", language: "en",
      body: "Namaste {{name}}, your quotation {{number}} for INR {{total}} is ready.",
      variables: [{ key: "name" }, { key: "number" }, { key: "total" }] as unknown as Prisma.InputJsonValue,
      status: "APPROVED", approvedAt: new Date(2025, 6, 15),
    },
  });
  const msgs: Prisma.MessageLogCreateManyInput[] = [];
  for (let i = 0; i < 500; i++) {
    msgs.push({
      orgId: c.ids.orgId, templateId: tmpl.id,
      toNumber: `+91${9100000000 + i * 100}`, direction: "OUTBOUND",
      category: "UTILITY", body: `Quotation ready.`,
      status: c.rng.weighted<Prisma.MessageLogCreateManyInput["status"]>([
        ["DELIVERED", 90], ["READ", 8], ["FAILED", 2],
      ]),
      costPaise: 12n,
      sentAt: c.rng.daysAgo(0, 90),
    });
  }
  await c.db.messageLog.createMany({ data: msgs });

  const notifRows: Prisma.NotificationCreateManyInput[] = [];
  for (const uid of c.ids.userIds) {
    for (let k = 0; k < 4; k++) {
      notifRows.push({
        orgId: c.ids.orgId, userId: uid,
        level: c.rng.pick(["INFO", "WARNING", "SUCCESS"] as const),
        title: c.rng.pick(["New quotation", "Payment received", "Stock low", "Follow-up due"]),
        body: "Details in your inbox.",
      });
    }
  }
  await c.db.notification.createMany({ data: notifRows });
}

// ── EDGE CASES (BUILD-SPEC §15) ──────────────────────────────
async function seedEdgeCases(c: Ctx): Promise<void> {
  const branchId = c.ids.branchIds[0]!;
  const client = c.clients[0]!;
  const overdue = c.clients.find((x) => x.type === "PROJECT") ?? client;

  // 1) Invoice cancelled after 24h + credit note
  await c.db.invoice.create({
    data: {
      orgId: c.ids.orgId, branchId, type: "TAX", clientId: overdue.id,
      number: `MDV/CBE/INV/25-26/EDGE01`,
      date: new Date(2026, 0, 10), dueDate: new Date(2026, 1, 9),
      placeOfSupply: overdue.stateCode,
      taxableAmount: 1_00_000_00n, cgst: 9_000_00n, sgst: 9_000_00n, igst: 0n, roundOff: 0n, total: 1_18_000_00n,
      irnStatus: "CANCELLED", status: "CANCELLED",
      cancelledAt: new Date(2026, 0, 12), cancelReason: "Client changed order - credit note issued.",
    },
  });
  await c.db.invoice.create({
    data: {
      orgId: c.ids.orgId, branchId, type: "CREDIT_NOTE", clientId: overdue.id,
      number: `MDV/CBE/CN/25-26/EDGE01`,
      date: new Date(2026, 0, 12), dueDate: new Date(2026, 0, 12),
      placeOfSupply: overdue.stateCode,
      taxableAmount: 1_00_000_00n, cgst: 9_000_00n, sgst: 9_000_00n, igst: 0n, roundOff: 0n, total: 1_18_000_00n,
      status: "ISSUED",
    },
  });

  // 2) Overdue 90+ day invoice
  await c.db.invoice.create({
    data: {
      orgId: c.ids.orgId, branchId, type: "TAX", clientId: overdue.id,
      number: `MDV/CBE/INV/25-26/EDGE02`,
      date: new Date(2026, 1, 1), dueDate: new Date(2026, 2, 3),
      placeOfSupply: overdue.stateCode,
      taxableAmount: 2_00_000_00n, cgst: 18_000_00n, sgst: 18_000_00n, igst: 0n, roundOff: 0n, total: 2_36_000_00n,
      status: "OVERDUE",
    },
  });

  // 3) Product below reorder
  const stockUnder = c.productIds[0]!;
  await c.db.stockBalance.updateMany({
    where: { productId: stockUnder },
    data: { quantity: new Prisma.Decimal(2), value: 200_00n },
  });

  // 4) Negative-margin project
  await c.db.project.create({
    data: {
      orgId: c.ids.orgId, branchId: c.ids.branchIds[0]!, clientId: overdue.id,
      number: "PRJ/25-26/EDGE01",
      name: "Negative-margin site — SRT Villa (edge case)",
      startDate: new Date(2025, 8, 1), targetEndDate: new Date(2026, 1, 28),
      status: "ACTIVE",
      orderValue: 20_00_000_00n, budgetMaterial: 25_00_000_00n, budgetLabour: 3_00_000_00n,
    },
  });

  // 5) Receipt with unallocated residual
  await c.db.receipt.create({
    data: {
      orgId: c.ids.orgId, branchId, clientId: overdue.id,
      number: "MDV/CBE/RCPT/25-26/EDGE01",
      date: new Date(2026, 3, 5), mode: "NEFT",
      amount: 5_00_000_00n, unallocated: 50_000_00n,
    },
  });
}
