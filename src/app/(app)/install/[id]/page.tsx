// /install/[id] — office view of a single install visit.
//
// Header shows the visit number, order/client, status, scheduled
// time. Body is the line list with per-line completion forms; the
// sidebar carries the transition controls (start/complete/sign) +
// the raise-snag form + the make-job status hint so the office can
// see WHY completeVisit is blocked before clicking.

import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatDate } from "@/kernel/datetime";
import { shortNumber } from "@/lib/short-number";
import { devContext } from "@/lib/dev-context";
import { getInstallVisit } from "@/modules/install/queries";
import { VisitControls } from "./_components/VisitControls";
import { LineCompletion } from "./_components/LineCompletion";
import { RaiseSnagForm } from "./_components/RaiseSnagForm";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function InstallVisitDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await devContext();
  const v = await getInstallVisit(ctx, id);
  if (!v) notFound();

  const canEditLines = v.status === "SCHEDULED" || v.status === "IN_PROGRESS";
  const canRaiseSnag = v.status !== "CANCELLED";

  return (
    <>
      <Topbar
        title={`Install Visit ${v.number}`}
        eyebrow={`${v.clientName} · Order ${v.orderNumber} · ${formatDate(v.scheduledAt)}${v.crewName ? ` · Crew ${v.crewName}` : " · Unassigned"}`}
        actions={
          <Link
            href={`/orders/${v.orderId}` as Route}
            className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover"
          >
            Open order
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 pb-10">
        {/* ── Line list ─────────────────────────────────────── */}
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <div className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              Lines ({v.lines.length})
            </div>
            <div className="text-[11px] text-text-dim tabular">
              {v.lines.filter((l) => Number(l.installedQty) > 0).length} in progress
            </div>
          </div>
          {v.lines.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-text-faint">
              No install lines on this visit.
            </div>
          ) : (
            <div className="divide-y divide-rule/60">
              {v.lines.map((l) => (
                <div key={l.id} className="px-4 py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3">
                  <div>
                    <div className="text-[13px] text-text leading-tight">{l.roomLabel}</div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      {l.productName} <span className="text-text-faint">— per {l.productUom.toLowerCase()}</span>
                    </div>
                    <div className="text-[11px] mt-2 space-y-0.5">
                      <div className="flex justify-between max-w-[220px]">
                        <span className="text-text-dim">Planned this visit</span>
                        <span className="tabular text-text">{l.plannedQty}</span>
                      </div>
                      {l.dyeLotUsed && (
                        <div className="flex justify-between max-w-[220px]">
                          <span className="text-text-dim">Dye lot used</span>
                          <span className="tabular text-text">{l.dyeLotUsed}</span>
                        </div>
                      )}
                      {l.issue && (
                        <div className="text-[10.5px] text-heat mt-1">
                          issue: {l.issue}
                        </div>
                      )}
                    </div>
                  </div>
                  <LineCompletion
                    lineId={l.id}
                    pendingForOrder={l.parentPendingQty}
                    currentInstalled={l.installedQty}
                    disabled={!canEditLines}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-2">
              Status
            </div>
            <div className="font-display text-[20px] font-semibold text-text mb-1">
              {v.status.replace("_", " ")}
            </div>
            {v.makeJobNumber && (
              <div className="text-[10.5px] text-text-dim tabular mb-4">
                Make {shortNumber(v.makeJobNumber, "MJ-")} · {v.makeJobStatus?.toLowerCase()}
              </div>
            )}
            <VisitControls
              visitId={v.id}
              status={v.status}
              hasSignature={v.clientSignatureKey != null}
            />

            <dl className="mt-5 space-y-1.5 text-[11.5px] border-t border-rule pt-4">
              <SideRow k="Scheduled"  v={formatDate(v.scheduledAt)} />
              {v.startedAt   && <SideRow k="Started"    v={formatDate(v.startedAt)} />}
              {v.completedAt && <SideRow k="Completed"  v={formatDate(v.completedAt)} />}
              <SideRow k="Client mobile" v={v.clientMobile} />
              <SideRow k="Signature"     v={v.clientSignatureKey ? "captured" : "pending"} />
            </dl>
          </div>

          {canRaiseSnag && (
            <div className="rounded-[14px] bg-surface border border-rule p-5">
              <RaiseSnagForm visitId={v.id} />
            </div>
          )}

          {v.snags.length > 0 && (
            <div className="rounded-[14px] bg-surface border border-rule p-5">
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-3">
                Snags from this visit ({v.snags.length})
              </div>
              <ul className="space-y-2">
                {v.snags.map((s) => (
                  <li key={s.id} className="text-[11.5px]">
                    <div className="flex justify-between gap-2">
                      <span className="text-text">{s.location}</span>
                      <span className="text-[9.5px] uppercase tracking-[0.06em] text-text-dim">{s.status.toLowerCase()}</span>
                    </div>
                    <div className="text-[10.5px] text-text-dim mt-0.5">{s.description}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function SideRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-text-dim uppercase tracking-[0.06em] text-[10px]">{k}</dt>
      <dd className="tabular text-text">{v}</dd>
    </div>
  );
}
