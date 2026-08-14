import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { AgeingBars } from "@/components/data/AgeingBars";
import { QuotationsInlineTable } from "@/components/data/QuotationsInlineTable";
import { devContext } from "@/lib/dev-context";
import { getClient } from "@/modules/clients/queries";
import { listQuotationsForClient } from "@/modules/quotations/queries";
import { ClientFollowUpForm } from "../_components/ClientFollowUpForm";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const client = await getClient(ctx, id);
  if (!client) notFound();
  const quotations = await listQuotationsForClient(ctx, client.id);

  const addr = client.billingAddress as {
    line1?: string; line2?: string; city?: string; pincode?: string; stateCode?: string;
  } | null;

  return (
    <>
      <Topbar
        title={client.name}
        eyebrow={`${client.type} · ${client.mobile} · Since ${client.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              Billing Address
            </div>
            {addr ? (
              <div className="text-[12.5px] text-text">
                <div>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</div>
                <div className="text-text-dim">{addr.city ?? ""}{addr.pincode ? ` — ${addr.pincode}` : ""}{addr.stateCode ? ` · State ${addr.stateCode}` : ""}</div>
              </div>
            ) : (
              <div className="text-[12px] text-text-faint">No billing address on file.</div>
            )}
          </div>

          <QuotationsInlineTable rows={quotations} seeAllHref="/quotations" />

          <ClientFollowUpForm clientId={client.id} />

          <div className="rounded-[14px] bg-surface border border-rule p-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              Contacts ({client.contacts.length})
            </div>
            {client.contacts.length === 0 ? (
              <div className="text-[12px] text-text-faint">No contact persons.</div>
            ) : (
              <ul className="space-y-2">
                {client.contacts.map((c) => (
                  <li key={c.id} className="text-[12.5px] flex items-baseline justify-between border-b border-rule/60 last:border-0 py-2">
                    <div>
                      <span className="text-text">{c.name}</span>
                      <span className="text-text-dim"> · {(c.designation ?? "—").toLowerCase()}</span>
                    </div>
                    <div className="text-text-dim tabular">{c.mobile}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Outstanding</div>
            <div className="font-display text-[26px] font-semibold text-text tabular-nums leading-none">
              {client.outstanding > 0n ? formatINR(client.outstanding) : "₹0"}
            </div>
            <div className="mt-4">
              <AgeingBars {...client.ageing} />
            </div>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">At a glance</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="Credit limit" v={client.creditLimit ? formatINR(client.creditLimit) : "—"} />
              <Row k="GSTIN" v={client.gstin ?? "—"} mono />
              <Row k="PAN" v={client.pan ?? "—"} mono />
              <Row k="Mobile" v={client.mobile} mono />
              {client.altMobile && <Row k="Alt mobile" v={client.altMobile} mono />}
              {client.email && <Row k="Email" v={client.email} />}
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className={`text-text text-right ${mono ? "tabular" : ""}`}>{v}</dd>
    </div>
  );
}
