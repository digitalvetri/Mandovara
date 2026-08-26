import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Zap, FolderPlus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { AgeingBars } from "@/components/data/AgeingBars";
import { QuotationsInlineTable } from "@/components/data/QuotationsInlineTable";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { getClient } from "@/modules/clients/queries";
import { listQuotationsForClient } from "@/modules/quotations/queries";
import { listRoundsForClient, type ClientRoundRow } from "@/modules/measurement/queries-client";
import { listOutstandingInvoicesForClient, listReceipts, type OutstandingInvoice, type ReceiptRow } from "@/modules/receipts/queries";
import { ClientFollowUpForm } from "../_components/ClientFollowUpForm";
import { BillingAddressCard } from "../_components/BillingAddressCard";
import { StartMeasurementFromClientButton } from "../_components/StartMeasurementFromClientButton";
import { ClientMeasurementsCard } from "../_components/ClientMeasurementsCard";
import { ClientLedgerPanel, type InvoiceLedgerRow, type ReceiptLedgerRow } from "../_components/ClientLedgerPanel";
import { DeleteClientAction } from "../_components/DeleteClientAction";

const STAGE_LABEL: Record<string, string> = {
  ENQUIRY: "Enquiry", MEASUREMENT: "Measurement", QUOTATION: "Quotation",
  ORDERED: "Ordered", PROCUREMENT: "Procurement", MAKE: "Make",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const STAGE_CLS: Record<string, string> = {
  ENQUIRY: "text-text-dim", MEASUREMENT: "text-info", QUOTATION: "text-accent",
  ORDERED: "text-gold", PROCUREMENT: "text-heat", MAKE: "text-heat",
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
  const canMeasure =
    ctx.permissions.has("measurement.create.any") ||
    ctx.permissions.has("measurement.create.own") ||
    ctx.permissions.has("measurement.create");
  const canViewMeasurement = ctx.permissions.has("measurement.view");

  const [quotations, measurementRounds] = await Promise.all([
    listQuotationsForClient(ctx, client.id),
    canViewMeasurement
      ? listRoundsForClient(ctx, client.id, 10).catch((): ClientRoundRow[] => [])
      : Promise.resolve<ClientRoundRow[]>([]),
  ]);

  const canCreateReceipt = ctx.permissions.has("receipt.create");
  const canViewReceipt   = ctx.permissions.has("receipt.view");

  let openInvoicesRaw: OutstandingInvoice[] = [];
  let receiptsRaw: { rows: ReceiptRow[] }   = { rows: [] };
  let defaultBranch: { id: string } | null  = null;

  if (canCreateReceipt || canViewReceipt) {
    [openInvoicesRaw, receiptsRaw, defaultBranch] = await Promise.all([
      canCreateReceipt
        ? listOutstandingInvoicesForClient(ctx, client.id).catch((): OutstandingInvoice[] => [])
        : Promise.resolve<OutstandingInvoice[]>([]),
      canViewReceipt
        ? listReceipts(ctx, { clientId: client.id, pageSize: 15 }).catch(() => ({ rows: [] as ReceiptRow[] }))
        : Promise.resolve({ rows: [] as ReceiptRow[] }),
      scoped(ctx).branch.findFirst({ where: { organizationId: ctx.orgId }, select: { id: true } }).catch(() => null),
    ]);
  }

  const invoiceLedgerRows: InvoiceLedgerRow[] = openInvoicesRaw.map((inv) => ({
    id: inv.id, number: inv.number,
    date: inv.date.toISOString(), dueDate: inv.dueDate.toISOString(),
    total: inv.total.toString(), outstanding: inv.outstanding.toString(),
  }));

  const receiptLedgerRows: ReceiptLedgerRow[] = receiptsRaw.rows.map((r) => ({
    id: r.id, number: r.number,
    date: r.date.toISOString(),
    mode: r.mode, amount: r.amount.toString(),
    reference: r.reference, chequeStatus: r.chequeStatus,
  }));

  return (
    <>
      <Topbar
        title={client.name}
        eyebrow={`${client.type} · ${client.mobile} · Since ${client.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`}
      />

      <div className="flex justify-end gap-2 pb-3">
        {ctx.permissions.has("client.update") && (
          <Link
            href={`/clients/${client.id}/edit` as Route}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-rule bg-surface px-3 py-1.5 text-[12px] text-text-dim hover:text-text hover:border-gold transition-colors"
          >
            Edit
          </Link>
        )}
        <Link
          href={`/quotations/quick?client=${client.id}` as Route}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-rule bg-surface px-3 py-1.5 text-[12px] text-text-dim hover:text-text hover:border-accent/60 transition-colors"
        >
          <Zap size={13} /> Send Rough Estimate
        </Link>
        {ctx.permissions.has("project.create") && (
          <Link
            href={`/projects/new?client=${client.id}` as Route}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-accent text-white px-3 py-1.5 text-[12px] font-medium hover:bg-accent/90 transition-colors"
          >
            <FolderPlus size={13} /> Start project
          </Link>
        )}
        <StartMeasurementFromClientButton
          clientId={client.id}
          projects={client.projects.map((p) => ({ id: p.id, name: p.name, stage: p.stage }))}
          canMeasure={canMeasure}
        />
        {ctx.permissions.has("client.delete") && (
          <DeleteClientAction
            clientId={client.id}
            clientName={client.name}
            projectCount={client.projects.length}
          />
        )}
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

          {canViewMeasurement && (
            <ClientMeasurementsCard
              clientId={client.id}
              projects={client.projects.map((p) => ({ id: p.id, name: p.name, stage: p.stage }))}
              rounds={measurementRounds}
              canMeasure={canMeasure}
            />
          )}

          <QuotationsInlineTable
            rows={quotations}
            seeAllHref="/quotations"
            newHref="/quotations/new"
          />

          {(canCreateReceipt || canViewReceipt) && (
            <ClientLedgerPanel
              clientId={client.id}
              branchId={defaultBranch?.id ?? ""}
              openInvoices={invoiceLedgerRows}
              receipts={receiptLedgerRows}
              canRecord={canCreateReceipt && !!defaultBranch}
            />
          )}

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
