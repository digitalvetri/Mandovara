import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { getLead } from "@/modules/leads/queries";
import { listBranches } from "@/modules/branches/queries";
import { LeadForm } from "../_components/LeadForm";
import { StatusPill } from "../_components/StatusPill";
import { StatusChanger } from "../_components/StatusChanger";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();

  const [lead, branches] = await Promise.all([
    getLead(ctx, id),
    listBranches(ctx),
  ]);
  if (!lead) notFound();

  return (
    <>
      <Topbar
        title={lead.name}
        eyebrow={`${lead.mobile} · ${lead.companyName ?? "No company"} · Created ${lead.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2">
          <div className="mb-4 rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">Status</div>
              <StatusPill status={lead.status} />
            </div>
            <StatusChanger id={lead.id} current={lead.status} />
          </div>

          <LeadForm
            mode="edit"
            branches={branches}
            initial={{
              id: lead.id,
              name: lead.name,
              mobile: lead.mobile.replace(/^\+91/, ""),
              email: lead.email ?? "",
              companyName: lead.companyName ?? "",
              source: lead.source as never,
              requirement: lead.requirement ?? "",
              expectedValue: lead.expectedValue ? String(Number(lead.expectedValue) / 100) : "",
              branchId: branches[0]?.id ?? "",
            }}
          />
        </div>

        <aside className="rounded-[14px] bg-surface border border-rule p-6 h-fit">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Summary</div>
          <dl className="space-y-3 text-[12.5px]">
            <Row k="Expected value" v={lead.expectedValue ? formatINR(lead.expectedValue) : "—"} />
            <Row k="Source" v={lead.source} />
            <Row k="Owner" v={lead.ownerId ?? "Unassigned"} />
            <Row k="Last updated" v={lead.updatedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })} />
          </dl>
        </aside>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className="text-text tabular text-right">{v}</dd>
    </div>
  );
}
