import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { getQuotation, type QuotationDetail } from "@/modules/quotations/queries";
import { QuotationHeader } from "./_components/QuotationHeader";
import { QuotationWorkspace } from "./_components/QuotationWorkspace";
import type { SerializedQuotation } from "./_types";

export const dynamic = "force-dynamic";

function serializeQuotation(q: QuotationDetail): SerializedQuotation {
  return {
    id: q.id,
    number: q.number,
    revision: q.revision,
    status: q.status,
    branchId: q.branchId,
    branchName: q.branchName,
    supplierStateCode: q.supplierStateCode,
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

  const canApprove = can(ctx, "quotation.approve");
  const serialized = serializeQuotation(q);

  return (
    <>
      <Topbar
        title={serialized.number}
        eyebrow={serialized.projectName}
      />
      <QuotationHeader quotation={serialized} canApprove={canApprove} />
      <QuotationWorkspace quotation={serialized} canApprove={canApprove} />
    </>
  );
}
