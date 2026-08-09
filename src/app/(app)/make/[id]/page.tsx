// /make/[id] — the make job detail: header with status advancer,
// cut-list table with per-line inline forms, and a print sheet link.
//
// The cut list numbers (panels, cutLengthMm) are the same numbers
// the estimator quoted — proven identical at every hop by the
// Phase 5a smoke. We render them in mono to signal that they're
// data, not typography.

import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { formatDate } from "@/kernel/datetime";
import { getMakeJob } from "@/modules/make/queries";
import { StatusAdvancer } from "./_components/StatusAdvancer";
import { LineActions } from "./_components/LineActions";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function MakeJobDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await devContext();
  const job = await getMakeJob(ctx, id);
  if (!job) notFound();

  const totalPanels = job.lines.reduce((n, l) => n + (l.panels ?? 0), 0);
  const totalCutLen = job.lines.reduce((n, l) => n + (l.cutLengthMm ?? 0) * (l.panels ?? 0), 0);

  return (
    <>
      <Topbar
        title={`Make Job ${job.number}`}
        eyebrow={`${job.clientName} · Order ${job.orderNumber} · ${job.lines.length} line${job.lines.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/make/${job.id}/print` as Route}
              className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover flex items-center gap-1.5"
            >
              <Printer size={13} /> Print cut sheet
            </Link>
            <Link
              href={`/orders/${job.orderId}` as Route}
              className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover"
            >
              Open order
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 pb-10">
        {/* ── Cut list table ─────────────────────────────────── */}
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <div className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              Cut list
            </div>
            <div className="text-[11px] text-text-dim tabular">
              {totalPanels} panel{totalPanels === 1 ? "" : "s"} · {(totalCutLen / 1000).toFixed(2)} m raw fabric
            </div>
          </div>
          {job.lines.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-text-faint">
              No made-to-measure lines on this job.
            </div>
          ) : (
            <div className="divide-y divide-rule/60">
              {job.lines.map((l) => (
                <div key={l.id} className="px-4 py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_260px] gap-3">
                  <div>
                    <div className="text-[13px] text-text leading-tight">{l.roomLabel}</div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      {l.productName} <span className="text-text-faint">— per {l.productUom.toLowerCase()}</span>
                    </div>
                    {l.engineVersion && (
                      <div className="text-[10px] text-text-faint tabular mt-1">
                        {l.engineVersion}
                      </div>
                    )}
                  </div>
                  <div className="text-[11.5px] space-y-1">
                    <NumRow label="Panels"      value={l.panels}       unit="" />
                    <NumRow label="Cut length"  value={l.cutLengthMm}   unit=" mm" />
                    <NumRow label="Fabric issued" value={l.fabricIssuedM} unit=" m" />
                    <NumRow label="Lining issued" value={l.liningIssuedM} unit=" m" showZeros />
                    <NumRow label="Actual used"   value={l.actualUsedM}   unit=" m" />
                    <NumRow label="Wastage"       value={l.wastageM}      unit=" m" showZeros />
                    {l.eyeletCount != null && (
                      <NumRow label="Eyelets/panel" value={l.eyeletCount} unit="" />
                    )}
                  </div>
                  <LineActions
                    lineId={l.id}
                    fabricIssuedM={l.fabricIssuedM}
                    liningIssuedM={l.liningIssuedM}
                    actualUsedM={l.actualUsedM}
                    qcPassed={l.qcPassed}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Status sidebar ─────────────────────────────────── */}
        <aside className="rounded-[14px] bg-surface border border-rule p-5 h-fit">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-2">
            Status
          </div>
          <div className="font-display text-[20px] font-semibold text-text mb-4">
            {job.status.replace("_", " ")}
          </div>
          <StatusAdvancer jobId={job.id} current={job.status} />

          <dl className="mt-5 space-y-1.5 text-[11.5px] border-t border-rule pt-4">
            <SidebarRow k="Created"    v={formatDate(job.createdAt)} />
            {job.startedAt && <SidebarRow k="Started" v={formatDate(job.startedAt)} />}
            {job.targetDate && <SidebarRow k="Target" v={formatDate(job.targetDate)} />}
            {job.completedAt && <SidebarRow k="Delivered" v={formatDate(job.completedAt)} />}
            <SidebarRow k="Client mobile" v={job.clientMobile} />
          </dl>
        </aside>
      </div>
    </>
  );
}

function NumRow({
  label, value, unit, showZeros,
}: { label: string; value: number | null; unit: string; showZeros?: boolean }) {
  const display = value == null
    ? "—"
    : value === 0 && !showZeros
      ? "—"
      : `${value}${unit}`;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-text-dim uppercase tracking-[0.06em] text-[9.5px]">{label}</dt>
      <dd className="tabular text-text">{display}</dd>
    </div>
  );
}

function SidebarRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-text-dim uppercase tracking-[0.06em] text-[10px]">{k}</dt>
      <dd className="tabular text-text">{v}</dd>
    </div>
  );
}
