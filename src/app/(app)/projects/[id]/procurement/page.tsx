// Procurement console — the "check stock first, PO only for shortfall"
// page the owner asked for. Was previously a raw /purchase list dump.

import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Package, ShoppingCart, AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getProject } from "@/modules/projects/queries";
import { getProjectProcurement } from "@/modules/procurement/queries";
import { ProcurementConsole } from "./_components/ProcurementConsole";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectProcurementPage({ params }: Props) {
  const { id } = await params;
  const ctx = await devContext();
  const project = await getProject(ctx, id);
  if (!project) notFound();

  const data = await getProjectProcurement(ctx, id);
  const canIssue = ctx.permissions.has("project.materialIssue");
  const canPO    = ctx.permissions.has("po.create");

  return (
    <>
      <Topbar
        title={`Procurement — ${project.name}`}
        eyebrow={`${project.number} · Check stock, issue what's available, raise POs only for the shortfall.`}
      />

      <div className="mb-5">
        <Link
          href={`/projects/${id}` as Route}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.75} />
          Back to project
        </Link>
      </div>

      {!data.order ? (
        <EmptyState projectId={id} />
      ) : (
        <>
          {/* Order summary */}
          <div className="mb-5 rounded-[14px] border border-rule bg-surface p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShoppingCart size={16} className="text-solid" />
              <div>
                <div className="text-[13px] font-medium text-text">Order {data.order.number}</div>
                <div className="text-[11px] text-text-dim uppercase tracking-[0.14em] mt-0.5">
                  {data.order.status.toLowerCase()}
                </div>
              </div>
            </div>
            <Link
              href={`/orders/${data.order.id}` as Route}
              className="text-[12px] text-accent hover:underline"
            >
              View order →
            </Link>
          </div>

          {/* Info banners */}
          {data.hasStock && data.hasShortfall && (
            <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-info/30 bg-info/8 px-4 py-2.5 text-[12px] text-text">
              <Package size={14} className="text-info mt-[2px] shrink-0" />
              <span>Some items are in stock and some need to be ordered. Issue what's available first, then raise a PO for the shortfall.</span>
            </div>
          )}
          {data.hasShortfall && !data.hasStock && (
            <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-heat/30 bg-heat/8 px-4 py-2.5 text-[12px] text-text">
              <AlertTriangle size={14} className="text-heat mt-[2px] shrink-0" />
              <span>Nothing in stock for these items. Raise a purchase order to procure them.</span>
            </div>
          )}

          <ProcurementConsole
            projectId={id}
            rows={data.rows}
            canIssue={canIssue}
            canPO={canPO}
          />
        </>
      )}
    </>
  );
}

function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-rule bg-surface py-14 text-center">
      <Package size={32} strokeWidth={1.25} className="mx-auto mb-3 text-text-dim/40" />
      <div className="text-[14px] font-medium text-text mb-1">No order to procure against</div>
      <div className="text-[12.5px] text-text-dim mb-4">
        Procurement kicks in once the client has accepted a quotation and the order is confirmed.
      </div>
      <Link
        href={`/projects/${projectId}` as Route}
        className="inline-flex items-center gap-1.5 rounded-[8px] border border-rule bg-surface-2 px-3.5 py-1.5 text-[12px] text-text-dim hover:text-text hover:border-accent/60 transition-colors"
      >
        Back to project
      </Link>
    </div>
  );
}
