import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Zap } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { AgeingBars } from "@/components/data/AgeingBars";
import { QuotationsInlineTable } from "@/components/data/QuotationsInlineTable";
import { devContext } from "@/lib/dev-context";
import { getClient } from "@/modules/clients/queries";
import { listQuotationsForClient } from "@/modules/quotations/queries";
import { ClientFollowUpForm } from "../_components/ClientFollowUpForm";
import { BillingAddressCard } from "../_components/BillingAddressCard";

const STAGE_LABEL: Record<string, string> = {
  ENQUIRY: "Enquiry", MEASUREMENT: "Measurement", QUOTATION: "Quotation",
  ORDERED: "Ordered", PROCUREMENT: "Procurement", MAKE: "Make",
  INSTALLATION: "Installation", SNAGGING: "Snagging",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const STAGE_CLS: Record<string, string> = {
  ENQUIRY: "text-text-dim", MEASUREMENT: "text-info", QUOTATION: "text-accent",
  ORDERED: "text-gold", PROCUREMENT: "text-heat", MAKE: "text-heat",
  INSTALLATION: "text-gold", SNAGGING: "text-fault",
  COMPLETED: "text-good", CANCELLED: "text-text-dim",
};

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const client = await getClient(ctx, id);
  if (!client) notFound();
  const quotations = await listQuotationsForClient(ctx, client.id);

  return (
    <>
      <Topbar
        title={client.name}
        eyebrow={`${client.type} · ${client.mobile} · Since ${client.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`}
      />

      <div className="flex justify-end pb-3">
        <Link
          href={`/quotations/quick?client=${client.id}` as Route}
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-gold px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-gold-strong transition-colors"
        >
          <Zap size={13} /> New quick quote
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <BillingAddressCard
            clientId={client.id}
            initial={client.billingAddress as { line1?: string; city?: string; state?: string; pincode?: string; country?: string } | null}
          />

          {/* Projects */}
          <div className="rounded-[14px] bg-surface border border-rule p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
                Projects ({client.projects.length})
              </div>
              <Link href={`/projects/new?client=${client.id}` as Route}
                    className="text-[12px] text-accent hover:underline">
                + New
              </Link>
            </div>
            {client.projects.length === 0 ? (
              <div className="text-[12px] text-text-faint py-3 text-center">No projects yet.</div>
            ) : (
              <div>
                {client.projects.map((p) => {
                  const sa = p.siteAddress as { city?: string; projectType?: string } | null;
                  return (
                    <Link key={p.id} href={`/projects/${p.id}` as Route}
                          className="flex items-center gap-3 py-2.5 border-b border-rule/60 last:border-0 hover:bg-surface-hover -mx-2 px-2 rounded-[6px] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-text truncate">{p.name}</span>
                          <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] ${STAGE_CLS[p.stage] ?? "text-text-dim"}`}>
                            {STAGE_LABEL[p.stage] ?? p.stage}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-text-dim mt-0.5">
                          {p.number}{sa?.city ? ` · ${sa.city}` : ""}{sa?.projectType ? ` · ${sa.projectType}` : ""}
                        </div>
                      </div>
                      {p.orderValue > 0n && (
                        <span className="text-[12px] text-text-dim tabular shrink-0">{formatINR(p.orderValue)}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <QuotationsInlineTable
            rows={quotations}
            seeAllHref="/quotations"
            newHref="/quotations/new"
          />

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
