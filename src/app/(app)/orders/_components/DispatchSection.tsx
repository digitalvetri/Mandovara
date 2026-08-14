"use client";

import { useState } from "react";
import { Truck, Calendar, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { DispatchForm } from "./DispatchForm";
import type { OrderLineRow, InstallVisitSummary } from "@/modules/orders/queries";

const INSTALL_STATUS_LABEL: Record<string, string> = {
  SCHEDULED:   "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
  PARTIAL:     "Partial",
  RESCHEDULED: "Rescheduled",
  CANCELLED:   "Cancelled",
};
const INSTALL_STATUS_COLOR: Record<string, string> = {
  SCHEDULED:   "text-heat",
  IN_PROGRESS: "text-info",
  COMPLETED:   "text-solid",
  PARTIAL:     "text-heat",
  RESCHEDULED: "text-text-muted",
  CANCELLED:   "text-fault",
};

interface DispatchSectionProps {
  orderId:   string;
  projectId: string;
  visits:    InstallVisitSummary[];
  lines:     OrderLineRow[];
  canEdit:   boolean;
}

export function DispatchSection({ orderId, projectId, visits, lines, canEdit }: DispatchSectionProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-muted flex items-center gap-2">
          <Truck size={13} className="text-text-muted" />
          Dispatch Visits
        </div>
        {canEdit && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="h-[28px] px-3 rounded-[6px] text-[11.5px] font-medium inline-flex items-center gap-1.5 transition-colors hover:bg-surface-hover border border-rule text-text-muted hover:text-text"
          >
            <ChevronDown size={12} />
            Schedule Dispatch
          </button>
        )}
        {showForm && (
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="h-[28px] px-3 rounded-[6px] text-[11.5px] text-text-muted inline-flex items-center gap-1 hover:bg-surface-hover"
          >
            <ChevronUp size={12} /> Collapse
          </button>
        )}
      </div>

      {visits.length > 0 && (
        <div className="space-y-2 mb-4">
          {visits.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 p-3 rounded-[8px] bg-surface-hover border border-rule/60"
            >
              <div className="flex items-center gap-2.5">
                {v.status === "COMPLETED"
                  ? <CheckCircle2 size={14} className="text-solid shrink-0" />
                  : <Clock size={14} className="text-text-muted shrink-0" />
                }
                <div>
                  <div className="text-[12px] font-medium text-text tabular-nums">{v.number}</div>
                  <div className="text-[11px] text-text-muted flex items-center gap-1.5">
                    <Calendar size={10} />
                    {v.scheduledAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    {v.completedAt && (
                      <span className="text-solid">
                        · Done {v.completedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-[10.5px] font-medium uppercase tracking-wide ${INSTALL_STATUS_COLOR[v.status] ?? "text-text-muted"}`}>
                {INSTALL_STATUS_LABEL[v.status] ?? v.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {visits.length === 0 && !showForm && (
        <div className="py-6 text-center">
          <Truck size={20} className="text-text-subtle mx-auto mb-2" />
          <p className="text-[12.5px] text-text-muted">No dispatch visits scheduled yet.</p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 h-[30px] px-4 rounded-[6px] text-[11.5px] font-medium transition-colors"
              style={{ background: "var(--color-gold)", color: "var(--color-ink)" }}
            >
              Schedule First Dispatch
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="border-t border-rule/60 pt-4">
          <DispatchForm
            orderId={orderId}
            projectId={projectId}
            lines={lines}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}
