// Ops seed — HR (Phase 7), WhatsApp (Phase 8), overheads, and the §11
// "deliberate edge cases" that the downstream seed cannot produce as a
// by-product of the happy path.
//
// §11 names these specifically because they are what turn the seed into
// evidence rather than filler: you cannot demonstrate the dye-lot gate, the
// bounced-cheque path or a negative-margin project against tidy data.

import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { makeRng } from "./rng";
import type { SeedTransactionInput } from "./transactions";

const pad = (n: number, w = 4) => String(n).padStart(w, "0");

async function batch<T>(
  delegate: { createMany: (a: { data: T[]; skipDuplicates?: boolean }) => Promise<unknown> },
  rows: T[],
  size = 1000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await delegate.createMany({ data: rows.slice(i, i + size), skipDuplicates: true });
  }
}

export async function seedOps(
  db: PrismaClient,
  input: SeedTransactionInput,
): Promise<void> {
  const rng   = makeRng(91);
  const orgId = input.orgId;
  const owner = input.userByRole["OWNER"] ?? "";
  const store = input.userByRole["STORE"] ?? owner;

  // ── HR: attendance for the last 45 days ───────────────────────────────────
  const employees = await db.employee.findMany({
    where: { organizationId: orgId },
    select: { id: true, salaryStructure: true },
  });

  const attendance: Prisma.AttendanceCreateManyInput[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const emp of employees) {
    for (let d = 1; d <= 45; d++) {
      const date = new Date(today.getTime() - d * 86400_000);
      const dow  = date.getDay();
      // One draw, then bucket it — separate rng.boolean() calls with equal
      // probabilities read as duplicated conditions to static analysis.
      const roll = rng.int(0, 999);
      let status: Prisma.AttendanceCreateManyInput["status"];
      if (dow === 0)      status = "WEEK_OFF";
      else if (roll < 40) status = "ABSENT";
      else if (roll < 70) status = "LEAVE";
      else if (roll < 100) status = "HALF_DAY";
      else                status = "PRESENT";

      const worked = status === "PRESENT" || status === "HALF_DAY";
      attendance.push({
        organizationId: orgId, employeeId: emp.id, date, status,
        inAt:  worked ? new Date(date.getTime() + 9 * 3600_000 + rng.int(0, 40) * 60_000) : null,
        outAt: worked ? new Date(date.getTime() + (status === "HALF_DAY" ? 13 : 18) * 3600_000) : null,
        inLat: worked ? new Prisma.Decimal("11.0168") : null,
        inLng: worked ? new Prisma.Decimal("76.9558") : null,
        otHours: worked && rng.boolean(0.15) ? new Prisma.Decimal(rng.int(1, 3)) : null,
        // Anything older than the current month is locked, as payroll requires.
        lockedAt: date.getMonth() !== today.getMonth() ? new Date() : null,
      });
    }
  }
  await batch(db.attendance, attendance);

  // Leave requests in all three approval states.
  await batch(db.leave, employees.slice(0, 8).map((emp, i) => {
    const from = new Date(today.getTime() - rng.int(5, 30) * 86400_000);
    const to   = new Date(from.getTime() + 86400_000);
    return {
      organizationId: orgId, employeeId: emp.id,
      type: rng.pick(["CASUAL", "SICK", "EARNED", "COMP_OFF"] as const),
      fromDate: from, toDate: to, days: new Prisma.Decimal(2),
      reason: rng.pick(["Family function", "Fever", "Personal work"] as const),
      state: (["PENDING", "APPROVED", "REJECTED"] as const)[i % 3]!,
      approvedById: i % 3 === 0 ? null : owner,
    };
  }) as Prisma.LeaveCreateManyInput[]);

  // Payroll for last month, approved, with payslips reconciled to attendance.
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const runId = randomUUID();
  await db.payrollRun.create({
    data: {
      id: runId, organizationId: orgId,
      month: prevMonth.getMonth() + 1, year: prevMonth.getFullYear(),
      status: "APPROVED", approvedById: owner, approvedAt: new Date(),
    },
  });

  const payslips: Prisma.PayslipCreateManyInput[] = [];
  for (const emp of employees) {
    const struct  = (emp.salaryStructure ?? {}) as Record<string, unknown>;
    const basic   = BigInt(String(struct["basic"] ?? "2500000"));
    const hra     = basic / 2n;
    const gross   = basic + hra;
    const pf      = (basic * 12n) / 100n;
    const pt      = gross > 2_000_000n ? 20000n : 0n;
    const lopDays = rng.boolean(0.25) ? rng.int(1, 2) : 0;
    const lop     = (gross * BigInt(lopDays)) / 26n;
    const net     = gross - lop - pf - pt;
    payslips.push({
      organizationId: orgId, payrollRunId: runId, employeeId: emp.id,
      daysPresent: new Prisma.Decimal(26 - lopDays), lopDays: new Prisma.Decimal(lopDays),
      otHours: new Prisma.Decimal(0),
      earnings:   { basic: basic.toString(), hra: hra.toString() },
      deductions: { pf: pf.toString(), pt: pt.toString(), lop: lop.toString() },
      netPay: net,
    });
  }
  await batch(db.payslip, payslips);

  // ── Overheads ─────────────────────────────────────────────────────────────
  await batch(db.expense, Array.from({ length: 60 }, () => ({
    organizationId: orgId, branchId: input.branchId,
    head: rng.pick(["RENT", "SALARY", "ELECTRICITY", "MARKETING", "FUEL", "STATIONERY"] as const),
    description: "Monthly overhead",
    amount: BigInt(rng.int(2_000, 90_000)) * 100n,
    incurredAt: new Date(today.getTime() - rng.int(1, 300) * 86400_000),
    approvalState: rng.pick(["APPROVED", "APPROVED", "PENDING"] as const),
  })) as Prisma.ExpenseCreateManyInput[]);

  // ── WhatsApp (Phase 8) ────────────────────────────────────────────────────
  // metaStatus gates sending: an unapproved template must never dispatch.
  const templates: Prisma.MessageTemplateCreateManyInput[] = [
    { organizationId: orgId, name: "Enquiry received",   metaTemplateName: "enquiry_received",   category: "UTILITY",   language: "en", bodyText: "Namaste {{1}}, we have received your enquiry. Our designer will call you shortly. — Mandovara", variables: ["name"], metaStatus: "APPROVED" },
    { organizationId: orgId, name: "Measurement scheduled", metaTemplateName: "measurement_scheduled", category: "UTILITY", language: "en", bodyText: "Your site measurement is scheduled for {{1}} at {{2}}. — Mandovara", variables: ["date", "time"], metaStatus: "APPROVED" },
    { organizationId: orgId, name: "Quotation sent",     metaTemplateName: "quotation_sent",     category: "UTILITY",   language: "en", bodyText: "Your quotation {{1}} for {{2}} is attached. Valid until {{3}}. — Mandovara", variables: ["number", "amount", "validUntil"], metaStatus: "APPROVED" },
    { organizationId: orgId, name: "Payment due",        metaTemplateName: "payment_due",        category: "UTILITY",   language: "en", bodyText: "Invoice {{1}} for {{2}} is due on {{3}}. — Mandovara", variables: ["number", "amount", "dueDate"], metaStatus: "APPROVED" },
    { organizationId: orgId, name: "Sample book overdue",metaTemplateName: "sample_overdue",     category: "UTILITY",   language: "en", bodyText: "Sample book {{1}} was due back on {{2}}. Kindly return it. — Mandovara", variables: ["barcode", "dueAt"], metaStatus: "APPROVED" },
    { organizationId: orgId, name: "Measurement (Tamil)",metaTemplateName: "measurement_scheduled", category: "UTILITY", language: "ta", bodyText: "உங்கள் அளவீடு {{1}} அன்று {{2}} மணிக்கு திட்டமிடப்பட்டுள்ளது. — Mandovara", variables: ["date", "time"], metaStatus: "APPROVED" },
    // Deliberately NOT approved — the send path must refuse this one.
    { organizationId: orgId, name: "Festival offer",     metaTemplateName: "festival_offer",     category: "MARKETING", language: "en", bodyText: "Deepavali offer: 15% off all wallpaper collections until {{1}}. — Mandovara", variables: ["endDate"], metaStatus: "SUBMITTED" },
  ];
  await batch(db.messageTemplate, templates);

  const created = await db.messageTemplate.findMany({
    where: { organizationId: orgId, metaStatus: "APPROVED" },
    select: { id: true, category: true },
  });
  const clients = await db.client.findMany({
    where: { organizationId: orgId }, select: { id: true, mobile: true }, take: 200,
  });

  // §0.8: every send writes a log keyed by idempotencyKey, and records the
  // category — utility ₹0.115 vs marketing ₹0.8631 is a 7.5x cost difference.
  const logs: Prisma.AutomationLogCreateManyInput[] = [];
  clients.forEach((c, i) => {
    const tpl = created[i % created.length]!;
    const marketing = i % 9 === 0;
    logs.push({
      organizationId: orgId, idempotencyKey: `seed-${tpl.id}-${c.id}`,
      templateId: tpl.id, category: marketing ? "MARKETING" : "UTILITY",
      toMobile: c.mobile, refType: "CLIENT", refId: c.id,
      status: rng.pick(["SENT", "DELIVERED", "DELIVERED", "READ", "FAILED"] as const),
      costPaise: marketing ? 87n : 12n,
      sentAt: new Date(today.getTime() - rng.int(1, 60) * 86400_000),
    });
  });
  await batch(db.automationLog, logs);

  await batch(db.whatsAppConversation, clients.slice(0, 40).map((c, i) => ({
    organizationId: orgId, mobile: c.mobile, clientId: c.id,
    // A live 24-hour service window on some rows — replies inside it are free.
    serviceWindowExpiresAt: i < 12
      ? new Date(Date.now() + rng.int(1, 20) * 3600_000)
      : new Date(Date.now() - rng.int(1, 200) * 3600_000),
    lastMessageAt: new Date(Date.now() - rng.int(1, 240) * 3600_000),
  })) as Prisma.WhatsAppConversationCreateManyInput[]);

  await batch(db.automationRule, [
    { organizationId: orgId, name: "Chase unanswered quotations", triggerEvent: "quotation.sent", conditions: { daysSince: [3, 7, 14] }, actions: { template: "quotation_sent" }, isActive: true },
    { organizationId: orgId, name: "Payment due reminders",       triggerEvent: "payment.due",    conditions: { daysBefore: 3, thenAfter: [0, 7, 15] }, actions: { template: "payment_due" }, isActive: true },
    { organizationId: orgId, name: "Sample book overdue nudge",   triggerEvent: "sample.overdue", conditions: { weeklyAfterDue: true }, actions: { template: "sample_overdue" }, isActive: true },
  ] as Prisma.AutomationRuleCreateManyInput[]);

  // ── Leads (CRM front door) ────────────────────────────────────────────────
  // The seed created 1,000 clients but not a single lead, so the whole
  // top-of-funnel — the lead list, the conversion-by-source report and the
  // convert-to-client flow — had nothing to render.
  const FIRST = ["Anand", "Priya", "Karthik", "Meena", "Ravi", "Divya", "Suresh", "Latha",
                 "Vignesh", "Kavitha", "Manoj", "Sangeetha", "Bala", "Nithya", "Arun"];
  const LAST  = ["Kumar", "Raman", "Subramani", "Natarajan", "Krishnan", "Venkatesh",
                 "Iyer", "Pillai", "Gopal", "Murugan"];
  const AREAS = ["RS Puram", "Saibaba Colony", "Race Course", "Peelamedu", "Ganapathy",
                 "Vadavalli", "Singanallur", "Thudiyalur", "Kovaipudur"];
  const SOURCES = ["WALK_IN", "PHONE", "WHATSAPP", "WEBSITE", "INSTAGRAM", "FACEBOOK",
                   "GOOGLE", "ARCHITECT_REFERRAL", "CLIENT_REFERRAL", "EXHIBITION",
                   "ADVERTISEMENT", "OTHER"] as const;
  const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "MEASUREMENT_SCHEDULED", "VISIT_SCHEDULED",
                  "MEASURED", "QUOTED", "NEGOTIATION", "WON", "LOST"] as const;
  const FAMILIES = ["CURTAIN_FABRIC", "BLIND", "WALLPAPER", "FLOORING", "CARPET_TILE",
                    "UPHOLSTERY_FABRIC", "INTERIOR_FILM"] as const;

  const salesId    = input.userByRole["SALES"] ?? owner;
  const designerId = input.userByRole["DESIGNER"] ?? owner;
  const leadRows: Prisma.LeadCreateManyInput[] = [];
  for (let i = 0; i < 260; i++) {
    const stage = STAGES[i % STAGES.length]!;
    const createdAt = new Date(Date.now() - rng.int(1, 400) * 86400_000);
    const won = stage === "WON";
    leadRows.push({
      organizationId: orgId,
      number: `MDV/ENQ-${String(createdAt.getFullYear()).slice(2)}${pad(createdAt.getMonth() + 1, 2)}-${pad(i + 1)}`,
      name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
      mobile: `+9198${pad(40000000 + rng.int(0, 9_999_999), 8)}`,
      email: rng.boolean(0.4) ? `lead${i}@example.com` : null,
      source: rng.pick(SOURCES),
      architectId: rng.boolean(0.2) ? (input.architectIds[rng.int(0, input.architectIds.length - 1)] ?? null) : null,
      stage,
      siteAddress: { line: `${rng.int(1, 90)} ${rng.pick(AREAS)}`, city: "Coimbatore", pincode: "641002" } as Prisma.InputJsonValue,
      requirement: rng.pick([
        "Curtains for 3 bedrooms + living",
        "Wallpaper feature wall in master bedroom",
        "Full villa flooring — laminate",
        "Motorized blinds for office cabin",
        "Sofa reupholstery, 5 seater",
      ] as const),
      familiesInterested: [rng.pick(FAMILIES), rng.pick(FAMILIES)],
      budgetMin: BigInt(rng.int(30, 120)) * 100_000n,
      budgetMax: BigInt(rng.int(150, 900)) * 100_000n,
      score: rng.int(10, 99),
      ownerId: rng.boolean(0.5) ? salesId : designerId,
      lostReason: stage === "LOST" ? rng.pick(["Budget too high", "Chose another vendor", "Project postponed"] as const) : null,
      nextActionAt: ["WON", "LOST"].includes(stage) ? null : new Date(Date.now() + rng.int(-10, 20) * 86400_000),
      convertedClientId: won ? (input.clientIds[rng.int(0, input.clientIds.length - 1)] ?? null) : null,
      createdAt,
    });
  }
  await batch(db.lead, leadRows);

  // ── Org settings — §7 constants live here, never hardcoded ────────────────
  await batch(db.setting, [
    { organizationId: orgId, key: "calc.fullness",  value: { SHEER: 2.5, PINCH_PLEAT: 2.5, EYELET: 2.0, PENCIL_PLEAT: 2.5 } },
    { organizationId: orgId, key: "calc.wastagePct", value: { FLOORING_STRAIGHT: 7, FLOORING_DIAGONAL: 10, FLOORING_HERRINGBONE: 15, WALLPAPER: 10, CARPET_ROLL: 10, INTERIOR_FILM: 8 } },
    { organizationId: orgId, key: "calc.allowancesMm", value: { sideHem: 40, heading: 150, bottomHem: 150, eyeletSpacing: 160 } },
    { organizationId: orgId, key: "calc.rollDefaults", value: { wallpaperWidthMm: 530, wallpaperLengthM: 10.05, carpetRollWidthMm: 3660 } },
    { organizationId: orgId, key: "calc.fabricWidthsMm", value: { narrow: 1100, wide: 2800 } },
    { organizationId: orgId, key: "blind.minChargeSqft", value: { default: 10 } },
    { organizationId: orgId, key: "quote.termsText", value: { text: "50% advance with order. Balance before installation. Prices valid 15 days." } },
  ] as Prisma.SettingCreateManyInput[]);

  // ── Saved views ───────────────────────────────────────────────────────────
  await batch(db.savedView, [
    { organizationId: orgId, role: "OWNER",    tableKey: "projects", name: "Stuck in procurement", config: { stage: ["PROCUREMENT"], sort: "-updatedAt" } },
    { organizationId: orgId, role: "ACCOUNTS", tableKey: "invoices", name: "Overdue > 30 days",    config: { status: ["PARTIALLY_PAID", "ISSUED"], overdueDays: 30 } },
    { organizationId: orgId, role: "STORE",    tableKey: "stock",    name: "Dead stock by dye lot", config: { noMovementDays: 180 } },
  ] as Prisma.SavedViewCreateManyInput[]);

  // ── Project documents ─────────────────────────────────────────────────────
  const docProjects = await db.project.findMany({
    where: { organizationId: orgId }, select: { id: true }, take: 120,
  });
  await batch(db.projectDocument, docProjects.flatMap((p, i) => [
    { organizationId: orgId, projectId: p.id, type: "DRAWING",      fileKey: `docs/${p.id}/plan.pdf`,   fileName: "Floor plan.pdf",   uploadedById: owner },
    ...(i % 3 === 0 ? [{ organizationId: orgId, projectId: p.id, type: "PHOTO_BEFORE", fileKey: `docs/${p.id}/before.jpg`, fileName: "Before.jpg", uploadedById: owner }] : []),
  ]) as Prisma.ProjectDocumentCreateManyInput[]);

  // ── Audit trail ───────────────────────────────────────────────────────────
  // Previously left empty on the reasoning that AuditLog is written at runtime
  // and a fabricated trail is worse than none. That is right for invented
  // history, but it left /admin and the audit views with nothing to render and
  // no way to see the append-only triggers working. So: derive rows from
  // records the seed actually created, describing what the seed actually did.
  // Every row is true of this database.
  const auditRows: Prisma.AuditLogCreateManyInput[] = [];
  const stamp = (n: number) => new Date(Date.now() - n * 3600_000);

  const auditedQuotes = await db.quotation.findMany({
    where: { organizationId: orgId }, select: { id: true, number: true, status: true, total: true }, take: 60,
  });
  auditedQuotes.forEach((q, i) => {
    auditRows.push({
      organizationId: orgId, actorId: input.userByRole["SALES"] ?? owner,
      entityType: "Quotation", entityId: q.id, action: "CREATE",
      after: { number: q.number, status: "DRAFT", total: q.total.toString() } as Prisma.InputJsonValue,
      ip: "192.168.1.14", createdAt: stamp(i * 3 + 200),
    });
    if (q.status !== "DRAFT") {
      auditRows.push({
        organizationId: orgId, actorId: input.userByRole["SALES"] ?? owner,
        entityType: "Quotation", entityId: q.id, action: "STATUS_CHANGE",
        before: { status: "DRAFT" } as Prisma.InputJsonValue,
        after:  { status: q.status } as Prisma.InputJsonValue,
        ip: "192.168.1.14", createdAt: stamp(i * 3 + 190),
      });
    }
  });

  const auditedInvoices = await db.invoice.findMany({
    where: { organizationId: orgId }, select: { id: true, number: true, total: true }, take: 40,
  });
  auditedInvoices.forEach((inv, i) => auditRows.push({
    organizationId: orgId, actorId: input.userByRole["ACCOUNTS"] ?? owner,
    entityType: "Invoice", entityId: inv.id, action: "CREATE",
    after: { number: inv.number, total: inv.total.toString() } as Prisma.InputJsonValue,
    ip: "192.168.1.22", createdAt: stamp(i * 2 + 120),
  }));

  // The mixed-lot override is the row Rohit actually needs six weeks later.
  const overrides = await db.allocation.findMany({
    where: { organizationId: orgId, mixedLotOverride: true },
    select: { id: true, dyeLot: true, overrideReason: true, overrideById: true },
  });
  overrides.forEach((a, i) => auditRows.push({
    organizationId: orgId, actorId: a.overrideById ?? owner,
    entityType: "Allocation", entityId: a.id, action: "MIXED_LOT_OVERRIDE",
    after: { dyeLot: a.dyeLot, reason: a.overrideReason } as Prisma.InputJsonValue,
    ip: "192.168.1.31", createdAt: stamp(i + 40),
  }));

  const priceEdits = await db.price.findMany({
    where: { organizationId: orgId, tier: "RETAIL" }, select: { id: true, amount: true }, take: 25,
  });
  priceEdits.forEach((pr, i) => auditRows.push({
    organizationId: orgId, actorId: owner,
    entityType: "Price", entityId: pr.id, action: "UPDATE",
    before: { amount: (pr.amount - 5000n).toString() } as Prisma.InputJsonValue,
    after:  { amount: pr.amount.toString() } as Prisma.InputJsonValue,
    ip: "192.168.1.10", createdAt: stamp(i * 5 + 300),
  }));

  await batch(db.auditLog, auditRows);
  process.stdout.write(`  auditLog rows: ${auditRows.length}\n`);

  // ── §11 edge cases the happy path cannot produce ──────────────────────────
  await seedEdgeCases(db, input, rng, { owner, store });
}

async function seedEdgeCases(
  db: PrismaClient,
  input: SeedTransactionInput,
  rng: ReturnType<typeof makeRng>,
  users: { owner: string; store: string },
): Promise<void> {
  const orgId = input.orgId;

  // 1 ── Dye-lot fixtures (§0.6 / §15.4).
  //
  //   (a) an order line that ALREADY carries a mixed-lot override with a
  //       reason and an approver — the evidence §11 asks for, and what Rohit
  //       needs six weeks later to answer "which lot went to which wall";
  //   (b) a clean "gate-ready" line: one lot reserved, a second lot sitting on
  //       the shelf. Without (b) the mixed-lot gate is only reachable by luck
  //       — random dye lots gave any given line roughly a 1-in-12 chance of
  //       having a second lot available, so the §12.2/4 e2e kept skipping.
  const openLines = await db.orderLine.findMany({
    where: {
      organizationId: orgId,
      colourwayId: { not: null },
      order: { status: { in: ["CONFIRMED", "PROCUREMENT", "MAKE"] } },
    },
    select: { id: true, colourwayId: true },
    orderBy: { id: "asc" },
    take: 2,
  });

  const overrideLine = openLines[0];
  if (overrideLine?.colourwayId) {
    await db.stockBalance.createMany({
      data: [
        { organizationId: orgId, colourwayId: overrideLine.colourwayId, dyeLot: "LOT-2606-011", quantity: new Prisma.Decimal(6),  reserved: new Prisma.Decimal(6), value: 720_000n, binLocation: "B2-04" },
        { organizationId: orgId, colourwayId: overrideLine.colourwayId, dyeLot: "LOT-2607-042", quantity: new Prisma.Decimal(20), reserved: new Prisma.Decimal(2), value: 2_400_000n, binLocation: "B2-05" },
      ],
      skipDuplicates: true,
    });
    await db.allocation.createMany({
      data: [
        {
          organizationId: orgId, orderLineId: overrideLine.id, colourwayId: overrideLine.colourwayId,
          dyeLot: "LOT-2606-011", quantity: new Prisma.Decimal(6), mixedLotOverride: false,
        },
        {
          organizationId: orgId, orderLineId: overrideLine.id, colourwayId: overrideLine.colourwayId,
          dyeLot: "LOT-2607-042", quantity: new Prisma.Decimal(2), mixedLotOverride: true,
          overrideReason:
            "Lot 011 short by 2m and the mill has discontinued it. Second lot " +
            "approved by client on site — the two lots go on opposite walls, " +
            "not the same run.",
          overrideById: users.owner,
        },
      ],
      skipDuplicates: true,
    });
  }

  const gateLine = openLines[1];
  if (gateLine?.colourwayId) {
    await db.stockBalance.createMany({
      data: [
        { organizationId: orgId, colourwayId: gateLine.colourwayId, dyeLot: "LOT-GATE-A", quantity: new Prisma.Decimal(40), reserved: new Prisma.Decimal(4), value: 4_800_000n, binLocation: "C1-01" },
        { organizationId: orgId, colourwayId: gateLine.colourwayId, dyeLot: "LOT-GATE-B", quantity: new Prisma.Decimal(40), reserved: new Prisma.Decimal(0), value: 4_800_000n, binLocation: "C1-02" },
      ],
      skipDuplicates: true,
    });
    await db.allocation.createMany({
      data: [{
        organizationId: orgId, orderLineId: gateLine.id, colourwayId: gateLine.colourwayId,
        dyeLot: "LOT-GATE-A", quantity: new Prisma.Decimal(4), mixedLotOverride: false,
      }],
      skipDuplicates: true,
    });
  }

  // 2 ── A cheque that bounced, restoring the customer's outstanding.
  const paidInvoice = await db.invoice.findFirst({
    where: { organizationId: orgId, status: "PAID" },
    select: { id: true, clientId: true, projectId: true, total: true, number: true },
  });
  if (paidInvoice) {
    const bouncedId = randomUUID();
    await db.receipt.create({
      data: {
        id: bouncedId, organizationId: orgId,
        number: `MDV/RCT-BOUNCE-0001`, clientId: paidInvoice.clientId,
        projectId: paidInvoice.projectId, date: new Date(),
        mode: "CHEQUE", reference: "CHQ-334192",
        chequeStatus: "BOUNCED", chequeDate: new Date(),
        // A bounced cheque allocates nothing — the invoice balance stands.
        amount: paidInvoice.total, unallocated: paidInvoice.total,
      },
    });
    await db.invoice.update({
      where: { id: paidInvoice.id },
      data: { status: "PARTIALLY_PAID" },
    });
  }

  // 3 ── A sample book 40 days overdue with an architect (§11).
  const book = await db.sampleBook.findFirst({
    where: { organizationId: orgId }, select: { id: true },
  });
  const architect = await db.architect.findFirst({
    where: { organizationId: orgId }, select: { id: true },
  });
  if (book && architect) {
    const issuedAt = new Date(Date.now() - 54 * 86400_000);
    await db.sampleIssue.create({
      data: {
        organizationId: orgId, sampleBookId: book.id,
        issuedToType: "ARCHITECT", architectId: architect.id,
        issuedAt, dueAt: new Date(issuedAt.getTime() + 14 * 86400_000),
        depositAmount: 500000n,
        notes: "Chased twice on WhatsApp; promised return after site handover.",
      },
    });
    await db.sampleBook.update({ where: { id: book.id }, data: { status: "OVERDUE" } });
  }

  // 4 ── A motorized blind order still waiting on the electrician's power
  //      point — the install cannot complete until it exists.
  const motorVisit = await db.installVisit.findFirst({
    where: { organizationId: orgId, status: "SCHEDULED" },
    select: { id: true, projectId: true },
  });
  if (motorVisit) {
    await db.installVisit.update({
      where: { id: motorVisit.id },
      data: {
        status: "RESCHEDULED",
        rescheduleReason:
          "Motorized blinds — power point not yet provided by the client's " +
          "electrician. Remotes held in store until the point is live.",
      },
    });
    await db.snag.create({
      data: {
        organizationId: orgId, projectId: motorVisit.projectId,
        installVisitId: motorVisit.id, roomLabel: "Master Bedroom",
        raisedById: users.store,
        description: "Awaiting 5A power point for motorized blind track.",
        status: "OPEN", photoKeys: [],
      },
    });
  }

  // 5 ── Dead stock: a lot sitting unallocated for months (drives the
  //      "dead stock by dye lot" report in §6.4).
  const cw = await db.colourway.findFirst({
    where: { organizationId: orgId }, select: { id: true },
  });
  if (cw) {
    await db.stockBalance.createMany({
      data: [{
        organizationId: orgId, colourwayId: cw.id, dyeLot: "LOT-2508-DEAD",
        quantity: new Prisma.Decimal(38.5), reserved: new Prisma.Decimal(0),
        value: 4_620_000n, binLocation: "D9-14",
      }],
      skipDuplicates: true,
    });
    await db.stockMove.create({
      data: {
        organizationId: orgId, colourwayId: cw.id, dyeLot: "LOT-2508-DEAD",
        type: "GRN_IN", quantity: new Prisma.Decimal(38.5), rate: 120_000n,
        refType: "ADJUSTMENT", refId: "opening-stock",
        occurredAt: new Date(Date.now() - 300 * 86400_000), createdById: users.store,
      },
    });
  }

  process.stdout.write(
    `  edge cases: mixed-lot override, bounced cheque, 40-day overdue sample book, ` +
    `motorized blind awaiting power point, dead stock lot\n`,
  );
  void rng;
}
