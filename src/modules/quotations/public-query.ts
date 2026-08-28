// Public (unauthenticated) quotation fetch — used by /q/[token] route.
// Uses authBootstrapPrisma (DATABASE_URL, bypasses RLS) because no
// RequestContext exists yet. Safe because the token is 256-bit random.

import { authBootstrapPrisma as db } from "@/kernel/db/client";
import type { QuotationDetail } from "./queries";
import { cityOf } from "./queries-part2";

const ALLOWED_STATUSES = new Set(["SENT", "APPROVED", "ACCEPTED", "REJECTED", "EXPIRED"]);

export async function getQuotationByShareToken(
  token: string,
): Promise<QuotationDetail | null> {
  const row = await db.quotation.findUnique({
    where: { shareToken: token },
    select: {
      id: true, number: true, revision: true, status: true, branchId: true,
      leadId: true, projectId: true, clientId: true, ownerId: true,
      date: true, validUntil: true, termsText: true, shareToken: true, shareTokenExpiresAt: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, roundOff: true, total: true,
      project: { select: { name: true, siteAddress: true, client: { select: { id: true, name: true, mobile: true, email: true, gstin: true, billingAddress: true } } } },
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
  if (!ALLOWED_STATUSES.has(row.status)) return null;
  if (row.shareTokenExpiresAt && row.shareTokenExpiresAt < new Date()) return null;

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: row.branchId }, select: { name: true, stateCode: true },
  });

  let clientName = "—", clientMobile = "", clientEmail: string | null = null;
  let clientGstin: string | null = null, projectName: string | null = null;
  // Same site-area rule as getQuotation. This is the query behind
  // /q/<token>/pdf — the PDF that actually goes out over WhatsApp — so a
  // field added only to the app-side query would render blank here.
  let siteArea: string | null = null;
  if (row.project) {
    clientName   = row.project.client.name;
    clientMobile = row.project.client.mobile;
    clientEmail  = row.project.client.email;
    clientGstin  = row.project.client.gstin;
    projectName  = row.project.name;
    siteArea     = cityOf(row.project.siteAddress)
                ?? cityOf(row.project.client.billingAddress);
  } else if (row.leadId) {
    const lead = await db.lead.findUnique({
      where: { id: row.leadId },
      select: { name: true, mobile: true, email: true, siteAddress: true },
    });
    if (lead) {
      clientName = lead.name; clientMobile = lead.mobile; clientEmail = lead.email;
      siteArea = cityOf(lead.siteAddress);
    }
  }

  const colIds = [...new Set(row.lines.map(l => l.colourwayId).filter((x): x is string => !!x))];
  const cws = colIds.length ? await db.colourway.findMany({
    where: { id: { in: colIds } },
    select: { id: true, code: true, hex: true, design: { select: { name: true, hsn: true, collection: { select: { brand: { select: { name: true } } } } } } },
  }) : [];
  const cwMap = new Map(cws.map(c => [c.id, c]));
  const owner = row.ownerId ? await db.user.findUnique({ where: { id: row.ownerId }, select: { name: true } }) : null;

  return {
    id: row.id, number: row.number, revision: row.revision, status: row.status,
    branchId: row.branchId, branchName: branch.name, supplierStateCode: branch.stateCode,
    ownerName: owner?.name ?? null, leadId: row.leadId, clientId: row.clientId,
    clientName, clientMobile, clientEmail, clientGstin, projectName, siteArea, projectId: row.projectId,
    date: row.date, validUntil: row.validUntil, termsText: row.termsText,
    shareToken: row.shareToken ?? null, shareTokenExpiresAt: row.shareTokenExpiresAt ?? null,
    taxableAmount: row.taxableAmount, cgst: row.cgst, sgst: row.sgst,
    igst: row.igst, roundOff: row.roundOff, total: row.total,
    lines: row.lines.map((l) => {
      const cw = l.colourwayId ? cwMap.get(l.colourwayId) : undefined;
      return {
        id: l.id, lineNo: l.lineNo, colourwayId: l.colourwayId,
        serviceRateId: l.serviceRateId, measurementItemId: l.measurementItemId,
        roomLabel: l.roomLabel, description: l.description,
        quantity: l.quantity.toString(), unit: l.unit, rate: l.rate,
        discountPct: l.discountPct.toString(), taxable: l.taxable,
        gstRate: l.gstRate.toString(), cgst: l.cgst, sgst: l.sgst, igst: l.igst,
        amount: l.amount, isOptional: l.isOptional,
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
