import { notFound } from "next/navigation";
import Image from "next/image";
import { Download, FileText } from "lucide-react";
import { getQuotationByShareToken } from "@/modules/quotations/public-query";

export const dynamic = "force-dynamic";

function fmt(n: bigint): string {
  const rupees = Number(n) / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export default async function PublicQuotationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const q = await getQuotationByShareToken(token);
  if (!q) notFound();

  const pdfUrl = `/q/${token}/pdf`;
  const total = fmt(q.total);
  const validDate = fmtDate(q.validUntil);
  const quoteDate = fmtDate(q.date);
  const isIntra = q.cgst > 0n;

  return (
    <div className="min-h-screen bg-[#F4F7F6] flex flex-col">

      {/* ── Branded header ─────────────────────────────────────── */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/icons/icon-192.png" alt="Mandovara" width={32} height={32} className="rounded-[8px]" />
          <span className="font-semibold text-[15px] text-[#111827]">Mandovara</span>
        </div>
        <a
          href="tel:+918940430051"
          className="text-[12.5px] text-[#6B7280] hover:text-[#111827] transition-colors"
        >
          +91 89404 30051
        </a>
      </header>

      {/* ── Main card ──────────────────────────────────────────── */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-[560px] space-y-4">

          {/* Title + status */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-medium mb-1">Quotation</p>
            <h1 className="text-[26px] font-bold text-[#111827] leading-tight">{q.number}</h1>
          </div>

          {/* White card */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-sm overflow-hidden">

            {/* Accent stripe */}
            <div className="h-[5px] bg-[#1B8A7E]" />

            <div className="p-6 space-y-5">

              {/* Billed To */}
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.2em] text-[#6B7280] font-semibold mb-1.5">Billed To</p>
                <p className="text-[17px] font-semibold text-[#111827]">{q.clientName}</p>
                <p className="text-[13px] text-[#6B7280] mt-0.5">{q.clientMobile}</p>
                {q.projectName && (
                  <p className="text-[12.5px] text-[#1B8A7E] mt-0.5">{q.projectName}</p>
                )}
              </div>

              {/* Dates */}
              <div className="flex gap-8">
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.14em] text-[#6B7280] font-medium">Date</p>
                  <p className="text-[13px] text-[#111827] mt-0.5">{quoteDate}</p>
                </div>
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.14em] text-[#6B7280] font-medium">Valid Until</p>
                  <p className="text-[13px] text-[#111827] mt-0.5">{validDate}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[#E5E7EB]" />

              {/* Amount */}
              <div className="bg-[#F0FAF8] rounded-[12px] border border-[#1B8A7E]/15 p-5">
                <p className="text-[9.5px] uppercase tracking-[0.2em] text-[#1B8A7E] font-semibold mb-1">Total Amount</p>
                <p className="text-[34px] font-bold text-[#111827] leading-none mb-1">{total}</p>
                <p className="text-[11.5px] text-[#6B7280]">Inclusive of all taxes</p>

                {/* Tax breakdown */}
                <div className="mt-4 pt-3 border-t border-[#1B8A7E]/15 space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6B7280]">Subtotal</span>
                    <span className="text-[#111827] font-medium">{fmt(q.taxableAmount)}</span>
                  </div>
                  {isIntra ? (
                    <>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[#6B7280]">CGST</span>
                        <span className="text-[#111827] font-medium">{fmt(q.cgst)}</span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[#6B7280]">SGST</span>
                        <span className="text-[#111827] font-medium">{fmt(q.sgst)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#6B7280]">IGST</span>
                      <span className="text-[#111827] font-medium">{fmt(q.igst)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Download PDF */}
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-[10px] bg-[#1B8A7E] text-white text-[14px] font-semibold hover:bg-[#157a6e] transition-colors"
              >
                <Download size={16} strokeWidth={2.2} />
                Download Quotation PDF
              </a>

              {/* View inline */}
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-10 rounded-[10px] border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:text-[#111827] hover:border-[#d1d5db] transition-colors"
              >
                <FileText size={14} strokeWidth={1.75} />
                View PDF in browser
              </a>

            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-[11.5px] text-[#9CA3AF]">
            This quotation was prepared by Mandovara · Coimbatore
          </p>
        </div>
      </main>
    </div>
  );
}
