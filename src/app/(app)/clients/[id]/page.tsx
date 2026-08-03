import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { AgeingBars } from "@/components/data/AgeingBars";
import { devContext } from "@/lib/dev-context";
import { getClient } from "@/modules/clients/queries";
import { ClientForm } from "../_components/ClientForm";
import { StatusPill } from "../_components/StatusPill";
import { StatusChanger } from "../_components/StatusChanger";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const client = await getClient(ctx, id);
  if (!client) notFound();

  return (
    <>
      <Topbar
        title={client.name}
        eyebrow={`${client.type} · ${client.primaryMobile} · Since ${client.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">Status</div>
              <StatusPill status={client.status} />
            </div>
            <StatusChanger id={client.id} current={client.status} />
          </div>

          <ClientForm
            mode="edit"
            initial={{
              id: client.id,
              name: client.name,
              type: client.type as never,
              primaryMobile: client.primaryMobile.replace(/^\+91/, ""),
              primaryEmail: client.primaryEmail ?? "",
              gstin: client.gstin ?? "",
              pan: client.pan ?? "",
              stateCode: client.stateCode,
              paymentTerms: client.paymentTerms,
              creditLimit: client.creditLimit
                ? String(Number(client.creditLimit) / 100)
                : "",
            }}
          />

          <div className="rounded-[14px] bg-surface border border-rule p-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              Addresses ({client.addresses.length})
            </div>
            {client.addresses.length === 0 ? (
              <div className="text-[12px] text-text-faint">No addresses yet.</div>
            ) : (
              <ul className="space-y-3">
                {client.addresses.map((a) => (
                  <li key={a.id} className="text-[12.5px] border-b border-rule/60 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{a.label}</span>
                      {a.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/12 text-accent">Default</span>
                      )}
                    </div>
                    <div className="text-text">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</div>
                    <div className="text-text-dim">{a.city} — {a.pincode} · State {a.stateCode}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
                      <span className="text-text-dim"> · {c.role.toLowerCase()}</span>
                      {c.isPrimary && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/12 text-accent">Primary</span>
                      )}
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
              <Row k="Payment terms" v={`${client.paymentTerms} days`} />
              <Row k="GSTIN" v={client.gstin ?? "—"} mono />
              <Row k="PAN" v={client.pan ?? "—"} mono />
              <Row k="State" v={client.stateCode} />
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
