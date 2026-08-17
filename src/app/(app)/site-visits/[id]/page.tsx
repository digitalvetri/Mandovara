import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getSiteVisit } from "@/modules/site-visits/queries";
import { formatDate } from "@/kernel/datetime";
import { Calendar, MapPin, User, FileText, Camera, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  SCHEDULED:   "bg-info/12 text-info",
  IN_PROGRESS: "bg-heat/12 text-heat",
  COMPLETED:   "bg-solid/12 text-solid",
  CANCELLED:   "bg-surface-2 text-text-dim",
  RESCHEDULED: "bg-heat/12 text-heat",
};

export default async function SiteVisitDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const visit = await getSiteVisit(ctx, id);
  if (!visit) notFound();

  const hasPhotos     = visit.photoKeys.length > 0;
  const hasCheckIn    = visit.checkInLat != null && visit.checkInLng != null;
  const hasObserved   = !!visit.observations?.trim();
  const hasCustomer   = !!visit.customerNotes?.trim();

  return (
    <>
      <Topbar
        title={visit.number}
        eyebrow={`${visit.purpose} · ${visit.status.replace(/_/g, " ").toLowerCase()}`}
        actions={
          <Link
            href={"/site-visits" as Route}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-[8px] border border-rule text-[12px] text-text-dim hover:text-text hover:border-text-dim transition-colors"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            All visits
          </Link>
        }
      />

      <div className="max-w-[880px] mx-auto space-y-4">
        {/* Summary card */}
        <section className="rounded-[14px] bg-surface border border-rule p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-1">
                {visit.purpose}
              </div>
              <div className="font-display text-[22px] font-semibold text-text leading-tight">
                {visit.projectName ?? visit.leadName ?? "Site visit"}
              </div>
              {visit.clientName && (
                <div className="text-[12px] text-text-dim mt-0.5">{visit.clientName}</div>
              )}
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${STATUS_CHIP[visit.status] ?? "bg-surface-2 text-text-dim"}`}>
              {visit.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12.5px]">
            <Meta icon={<Calendar size={13} strokeWidth={1.75} />} label="Scheduled">
              <span className="tabular">{formatDate(visit.scheduledAt)}</span>
            </Meta>
            <Meta icon={<User size={13} strokeWidth={1.75} />} label="Assigned to">
              {visit.assignedTo}
            </Meta>
            {visit.startedAt && (
              <Meta icon={<Calendar size={13} strokeWidth={1.75} />} label="Started">
                <span className="tabular">{formatDate(visit.startedAt)}</span>
              </Meta>
            )}
            {visit.completedAt && (
              <Meta icon={<Calendar size={13} strokeWidth={1.75} />} label="Completed">
                <span className="tabular">{formatDate(visit.completedAt)}</span>
              </Meta>
            )}
            {hasCheckIn && (
              <Meta icon={<MapPin size={13} strokeWidth={1.75} />} label="Checked in at">
                <a
                  href={`https://maps.google.com/?q=${visit.checkInLat},${visit.checkInLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline tabular"
                >
                  {visit.checkInLat}, {visit.checkInLng} ↗
                </a>
              </Meta>
            )}
          </div>
        </section>

        {/* Notes */}
        {(hasObserved || hasCustomer) && (
          <section className="rounded-[14px] bg-surface border border-rule p-5 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={13} strokeWidth={1.75} className="text-text-dim" />
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Notes</div>
            </div>
            <div className="space-y-4">
              {hasObserved && (
                <div>
                  <div className="text-[11px] text-text-dim mb-1">Observations</div>
                  <p className="text-[13px] text-text leading-relaxed whitespace-pre-wrap">
                    {visit.observations}
                  </p>
                </div>
              )}
              {hasCustomer && (
                <div>
                  <div className="text-[11px] text-text-dim mb-1">Customer said</div>
                  <p className="text-[13px] text-text leading-relaxed whitespace-pre-wrap">
                    {visit.customerNotes}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Photos */}
        {hasPhotos && (
          <section className="rounded-[14px] bg-surface border border-rule p-5 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Camera size={13} strokeWidth={1.75} className="text-text-dim" />
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                Photos · {visit.photoKeys.length}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {visit.photoKeys.map((key) => (
                <a
                  key={key}
                  href={key.startsWith("http") ? key : `/uploads/${key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square rounded-[8px] border border-rule bg-surface-2 overflow-hidden hover:border-gold transition-colors"
                >
                  <img
                    src={key.startsWith("http") ? key : `/uploads/${key}`}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Empty prompt when nothing captured yet */}
        {!hasObserved && !hasCustomer && !hasPhotos && (
          <section className="rounded-[14px] bg-surface border border-rule px-6 py-10 text-center">
            <div className="text-[13px] text-text mb-1">Nothing recorded on this visit yet.</div>
            <p className="text-[11.5px] text-text-dim">
              Observations, customer notes and site photos captured during the visit will show up here.
            </p>
          </section>
        )}
      </div>
    </>
  );
}

// ── Bits ──────────────────────────────────────────────────────────

function Meta({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-text-dim mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-[13px] text-text">{children}</div>
    </div>
  );
}
