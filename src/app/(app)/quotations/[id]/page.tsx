import { notFound } from "next/navigation";
import { randomBytes } from "crypto";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { getQuotation, type QuotationDetail } from "@/modules/quotations/queries";
import { QuotationHeader } from "./_components/QuotationHeader";
import { scoped } from "@/kernel/db/scoped";
import { isEstimate } from "@/modules/quotations/lib";
import { canReissue } from "@/modules/quotations/reissue-schemas";
import { QuotationWorkspace } from "./_components/QuotationWorkspace";
import type { SerializedQuotation } from "./_types";

export const dynamic = "force-dynamic";

function serializeQuotation(q: QuotationDetail, shareToken: string | null): SerializedQuotation {
  return {
    id: q.id,
    number: q.number,
    revision: q.revision,
    status: q.status,
    branchId: q.branchId,
    branchName: q.branchName,
    supplierStateCode: q.supplierStateCode,
    leadId: q.leadId,
    clientId: q.clientId,
    clientName: q.clientName,
    clientMobile: q.clientMobile,
    clientEmail: q.clientEmail,
    clientGstin: q.clientGstin,
    projectId: q.projectId,
    projectName: q.projectName,
    date: q.date.toISOString(),
    validUntil: q.validUntil.toISOString(),
    taxableAmountStr: q.taxableAmount.toString(),
    cgstStr: q.cgst.toString(),
    sgstStr: q.sgst.toString(),
    igstStr: q.igst.toString(),
    roundOffStr: q.roundOff.toString(),
    totalStr: q.total.toString(),
    termsText: q.termsText,
    shareToken,
    lines: q.lines.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      description: l.description,
      roomLabel: l.roomLabel,
      quantity: l.quantity,
      unit: l.unit,
      rateStr: l.rate.toString(),
      discountPct: l.discountPct,
      taxableStr: l.taxable.toString(),
      gstRate: l.gstRate,
      cgstStr: l.cgst.toString(),
      sgstStr: l.sgst.toString(),
      igstStr: l.igst.toString(),
      amountStr: l.amount.toString(),
      isOptional: l.isOptional,
      measurementItemId: l.measurementItemId,
      colourwayId: l.colourwayId,
      serviceRateId: l.serviceRateId,
    })),
  };
}

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await devContext();
  const q = await getQuotation(ctx, id);
  if (!q) notFound();

  // Ensure a valid share token exists — generate (or refresh) if missing/expired.
  const now = new Date();
  let shareToken = q.shareToken;
  if (!shareToken || (q.shareTokenExpiresAt !== null && q.shareTokenExpiresAt < now)) {
    shareToken = randomBytes(32).toString("hex");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (scoped(ctx).quotation as any).update({
      where: { id: q.id },
      data: { shareToken, shareTokenExpiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) },
    });
  }

  const canApprove = can(ctx, "quotation.approve");
  const serialized = serializeQuotation(q, shareToken);

  // Work out up front whether this estimate can become a firm quotation, so
  // the button can say WHY not instead of just being absent.
  let reissueBlockedReason: string | undefined;
  if (isEstimate(q.lines)) {
    const approvedItems = q.projectId
      ? await scoped(ctx).measurementItem.count({
          where: { room: { projectId: q.projectId }, measurement: { status: "APPROVED" } },
        })
      : 0;
    const pre = canReissue({
      isEstimate: true,
      projectId: q.projectId,
      approvedMeasurementItems: approvedItems,
    });
    if (!pre.ok) reissueBlockedReason = pre.reason;
  }

  return (
    <>
      <QuotationHeader
        quotation={serialized}
        canApprove={canApprove}
        {...(reissueBlockedReason ? { reissueBlockedReason } : {})}
      />
      <QuotationWorkspace quotation={serialized} canApprove={canApprove} />
    </>
  );
}
