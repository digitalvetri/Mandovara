// Split out of queries.ts to stay under the §10 300-line limit.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { ListQuotationsQuery, QuotationDetail } from "./queries";

export async function getQuotation(
  ctx: RequestContext,
  id: string,
): Promise<QuotationDetail | null> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);

  const row = await db.quotation.findUnique({
    where: { id },
    select: {
      id: true, number: true, revision: true, status: true, branchId: true,
      leadId: true, projectId: true, clientId: true, ownerId: true,
      date: true, validUntil: true, termsText: true, shareToken: true, shareTokenExpiresAt: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, roundOff: true, total: true,
      project: {
        select: {
          name: true,
          client: { select: { id: true, name: true, mobile: true, email: true, gstin: true } },
        },
      },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, description: true,
          colourwayId: true, serviceRateId: true, measurementItemId: true, roomLabel: true,
          quantity: true, unit: true, rate: true,
          discountPct: true, taxable: true, gstRate: true,
          cgst: true, sgst: true, igst: true, amount: true, isOptional: true,
          calcSnapshot: true,
          item: { select: { widthMm: true, heightMm: true } },
        },
      },
    },
  });
  if (!row) return null;

  const branch = await db.branch.findUniqueOrThrow({
    where:  { id: row.branchId },
    select: { name: true, stateCode: true },
  });

  // Party info — from the linked project's client (client-scoped) or
  // from the lead directly (lead-scoped, FIXES-01 §5.1).
  let clientName   = "—";
  let clientMobile = "";
  let clientEmail: string | null = null;
  let clientGstin: string | null = null;
  let projectName: string | null = null;
  if (row.project) {
    clientName   = row.project.client.name;
    clientMobile = row.project.client.mobile;
    clientEmail  = row.project.client.email;
    clientGstin  = row.project.client.gstin;
    projectName  = row.project.name;
  } else if (row.leadId) {
    const lead = await db.lead.findUnique({
      where:  { id: row.leadId },
      select: { name: true, mobile: true, email: true },
    });
    if (lead) {
      clientName   = lead.name;
      clientMobile = lead.mobile;
      clientEmail  = lead.email;
    }
  }

  // Batch-resolve colourways (plain string FK — no Prisma relation)
  const colIds = [...new Set(row.lines.map(l => l.colourwayId).filter((x): x is string => !!x))];
  const cws = colIds.length ? await db.colourway.findMany({
    where: { id: { in: colIds } },
    select: { id: true, code: true, hex: true, design: { select: { name: true, hsn: true, collection: { select: { brand: { select: { name: true } } } } } } },
  }) : [];
  const cwMap = new Map(cws.map(c => [c.id, c]));
  const owner = row.ownerId ? await db.user.findUnique({ where: { id: row.ownerId }, select: { name: true } }) : null;

  return {
    id: row.id,
    number: row.number,
    revision: row.revision,
    status: row.status,
    branchId: row.branchId,
    branchName: branch.name,
    supplierStateCode: branch.stateCode,
    ownerName: owner?.name ?? null,
    leadId:      row.leadId,
    clientId:    row.clientId,
    clientName,
    clientMobile,
    clientEmail,
    clientGstin,
    projectName,
    projectId:   row.projectId,
    date: row.date,
    validUntil: row.validUntil,
    termsText: row.termsText, shareToken: row.shareToken ?? null, shareTokenExpiresAt: row.shareTokenExpiresAt ?? null,
    taxableAmount: row.taxableAmount,
    cgst: row.cgst,
    sgst: row.sgst,
    igst: row.igst,
    roundOff: row.roundOff,
    total: row.total,
    lines: row.lines.map((l) => {
      const cw = l.colourwayId ? cwMap.get(l.colourwayId) : undefined;
      return {
        id: l.id,
        lineNo: l.lineNo,
        colourwayId: l.colourwayId,
        serviceRateId: l.serviceRateId,
        measurementItemId: l.measurementItemId,
        roomLabel: l.roomLabel,
        description: l.description,
        quantity: l.quantity.toString(),
        unit: l.unit,
        rate: l.rate,
        discountPct: l.discountPct.toString(),
        taxable: l.taxable,
        gstRate: l.gstRate.toString(),
        cgst: l.cgst,
        sgst: l.sgst,
        igst: l.igst,
        amount: l.amount,
        isOptional: l.isOptional,
        hsn:           cw?.design?.hsn          ?? null,
        colourHex:     cw?.hex                  ?? null,
        colourwayCode: cw?.code                 ?? null,
        designName:    cw?.design?.name         ?? null,
        brandName:     cw?.design?.collection?.brand?.name ?? null,
        calcSnapshot:  l.calcSnapshot as Record<string, unknown> | null,
        widthMm:       l.item?.widthMm?.toString()  ?? null,
        heightMm:      l.item?.heightMm?.toString() ?? null,
      };
    }),
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

export function buildWhere(q: ListQuotationsQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      { project: { client: { name: { contains: s, mode: "insensitive" } } } },
    ];
  }
  if (q.status && q.status !== "ALL") where["status"] = q.status;
  if (q.projectId) where["projectId"] = q.projectId;
  if (q.dateFrom || q.dateTo) {
    const dateFilter: WhereInput = {};
    if (q.dateFrom) dateFilter["gte"] = q.dateFrom;
    if (q.dateTo) dateFilter["lte"] = q.dateTo;
    where["date"] = dateFilter;
  }
  return where;
}

export function orderFor(sort: ListQuotationsQuery["sort"]): { [k: string]: "asc" | "desc" } {
  switch (sort) {
    case "oldest": return { date: "asc" };
    case "total":  return { total: "desc" };
    default:       return { date: "desc" };
  }
}

// FIXES-01 §7.3 — quick list of open (DRAFT) quotations for the
// PDP's Add-to-Quote modal. Filters to only APPENDABLE states.
export interface OpenQuotationOption {
  id:         string;
  number:     string;
  clientName: string; // "Lead: X" for lead-scoped, "Client: X" otherwise
  total:      bigint;
  date:       Date;
  isLead:     boolean;
}
export async function listOpenQuotationsForAppend(
  ctx: RequestContext,
): Promise<OpenQuotationOption[]> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);
  const rows = await db.quotation.findMany({
    where:   { status: { in: ["DRAFT", "REVISED"] } },
    orderBy: { date: "desc" },
    take:    25,
    select: {
      id: true, number: true, total: true, date: true,
      leadId: true, clientId: true,
      project: { select: { client: { select: { name: true } } } },
    },
  });
  const leadIds = Array.from(new Set(rows.map((r) => r.leadId).filter((x): x is string => !!x)));
  const leads = leadIds.length > 0
    ? await db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } })
    : [];
  const leadName = new Map(leads.map((l) => [l.id, l.name] as const));
  return rows.map((r) => ({
    id:         r.id,
    number:     r.number,
    clientName: r.leadId
      ? `Lead: ${leadName.get(r.leadId) ?? "—"}`
      : `Client: ${r.project?.client.name ?? "—"}`,
    total:      r.total,
    date:       r.date,
    isLead:     !!r.leadId,
  }));
}
