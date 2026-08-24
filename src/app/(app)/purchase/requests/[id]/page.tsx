import { notFound } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { getPurchaseRequest } from "@/modules/purchase-requests/queries";
import { ApprovalButtons } from "../_components/ApprovalButtons";
import { ConvertToPOButton } from "./_components/ConvertToPOButton";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  DRAFT:     "bg-surface-2 text-text-dim",
  SUBMITTED: "bg-heat/12 text-heat",
  APPROVED:  "bg-solid/12 text-solid",
  REJECTED:  "bg-fault/12 text-fault",
};

export default async function PurchaseRequestDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const r = await getPurchaseRequest(ctx, id);
  if (!r) notFound();

  return (
    <>
      <Topbar
        title={r.number}
        eyebrow={`Raised by ${r.raisedBy}${r.neededBy ? ` · needed by ${formatDate(r.neededBy)}` : ""}`}
        actions={
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${STATUS_CHIP[r.status] ?? "bg-surface-2 text-text-dim"}`}>
              {r.status}
            </span>
            {r.status === "SUBMITTED" && r.canApprove && <ApprovalButtons id={id} />}
            {r.status === "APPROVED" && r.canApprove && (
              <ConvertToPOButton requestId={id} />
            )}
          </div>
        }
      />

      <div className="space-y-4 pb-10">

        {/* ── Meta ────────────────────────────────────────────────────────── */}
        <div className="rounded-[14px] bg-surface border border-rule p-5">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Details</div>
          <dl className="space-y-2 text-[12.5px]">
            <Row k="Reason"     v={r.reason} />
            {r.projectName && <Row k="Project"   v={r.projectName} />}
            {r.neededBy    && <Row k="Needed by" v={formatDate(r.neededBy)} />}
            {r.approvedBy  && <Row k="Approved by" v={r.approvedBy} />}
            {r.approvedAt  && <Row k="Approved at" v={formatDate(r.approvedAt)} />}
            {r.rejectionReason && (
              <div className="pt-2 text-[11.5px] text-fault">{r.rejectionReason}</div>
            )}
          </dl>
        </div>

        {/* ── Lines ───────────────────────────────────────────────────────── */}
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <div className="px-4 h-[38px] flex items-center border-b border-rule text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
            Lines ({r.lines.length})
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Item</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Unit</Th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l) => (
                <tr key={l.id} className="border-b border-rule/60 last:border-0">
                  <Td>
                    {l.colourCode ? (
                      <div>
                        <div className="font-medium text-text">{l.colourCode}</div>
                        <div className="text-[11px] text-text-dim">{l.colourName}</div>
                      </div>
                    ) : (
                      <span className="text-text-dim">{l.freeTextItem}</span>
                    )}
                  </Td>
                  <Td align="right"><span className="tabular">{l.quantity}</span></Td>
                  <Td align="right"><span className="text-text-dim text-[11px]">{l.unit.toLowerCase()}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Link href={"/purchase/requests" as Route} className="inline-flex text-[11.5px] text-text-dim hover:text-text">
          ← All requests
        </Link>
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>{children}</td>;
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className="text-text">{v}</dd>
    </div>
  );
}
