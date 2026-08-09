import { notFound } from "next/navigation";
import { Phone, Mail, Compass, IndianRupee, ClipboardList } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { getLead } from "@/modules/leads/queries";
import { listFollowUpsForLead } from "@/modules/followups/queries";
import { LEAD_SOURCES } from "@/modules/leads/schema";
import { StatusPill } from "../_components/StatusPill";
import { StatusChanger } from "../_components/StatusChanger";
import { ConvertButton } from "../_components/ConvertButton";
import { LeadFollowUpForm } from "../_components/LeadFollowUpForm";
import { EditableField } from "../_components/EditableField";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website", REFERRAL: "Referral", WHATSAPP: "WhatsApp",
  WALK_IN: "Walk-in", EXHIBITION: "Exhibition", COLD_CALL: "Cold call", OTHER: "Other",
};

const SOURCE_OPTIONS = LEAD_SOURCES.map((s) => ({
  value: s,
  label: SOURCE_LABEL[s] ?? s,
}));

export default async function LeadDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();

  const [lead, followUps] = await Promise.all([
    getLead(ctx, id),
    listFollowUpsForLead(ctx, id),
  ]);
  if (!lead) notFound();

  const createdDate = lead.createdAt.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
  const budgetRupees = lead.budgetMax
    ? String(Number(lead.budgetMax) / 100)
    : "";
  const budgetDisplay = lead.budgetMax ? formatINR(lead.budgetMax) : "";
  const isConverted = lead.convertedClientId != null;

  return (
    <>
      {/* ── Hero: editable title, breadcrumb, status, primary actions ── */}
      <div className="pt-5 pb-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-2">
          Leads · Created {createdDate}
        </div>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <EditableField
              leadId={lead.id}
              field="name"
              value={lead.name}
              label="Lead name"
              placeholder="Untitled lead"
              size="lg"
              readOnly={isConverted}
            />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusPill status={lead.stage} />
            <ConvertButton
              id={lead.id}
              status={lead.stage}
              convertedClientId={lead.convertedClientId}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        {/* ── Main column ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {isConverted && (
            <div className="rounded-[14px] bg-good/8 border border-good/30 p-4 text-[12.5px] text-text">
              This lead has been converted to a client. Edits here won&apos;t sync — update the client record instead.
            </div>
          )}

          {/* At-a-glance pills — every field click-to-edit (locked when converted) */}
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              <EditableField
                leadId={lead.id}
                field="mobile"
                value={lead.mobile.replace(/^\+91/, "")}
                displayValue={lead.mobile}
                label="Mobile"
                placeholder="Add mobile"
                icon={<Phone size={14} strokeWidth={1.75} />}
                variant="tel"
                readOnly={isConverted}
              />
              <EditableField
                leadId={lead.id}
                field="email"
                value={lead.email ?? ""}
                label="Email"
                placeholder="Add email"
                icon={<Mail size={14} strokeWidth={1.75} />}
                variant="email"
                readOnly={isConverted}
              />
              <EditableField
                leadId={lead.id}
                field="source"
                value={lead.source}
                displayValue={SOURCE_LABEL[lead.source] ?? lead.source}
                label="Source"
                icon={<Compass size={14} strokeWidth={1.75} />}
                variant="select"
                options={SOURCE_OPTIONS}
                readOnly={isConverted}
              />
              <EditableField
                leadId={lead.id}
                field="expectedValue"
                value={budgetRupees}
                displayValue={budgetDisplay}
                label="Expected value"
                placeholder="Add expected value"
                icon={<IndianRupee size={14} strokeWidth={1.75} />}
                readOnly={isConverted}
              />
              <EditableField
                leadId={lead.id}
                field="requirement"
                value={lead.requirement ?? ""}
                label="Requirement"
                placeholder="What are they asking about?"
                icon={<ClipboardList size={14} strokeWidth={1.75} />}
                variant="textarea"
                readOnly={isConverted}
              />
            </div>
          </div>

          {/* Status quick-change bar — hidden once converted (status is WON) */}
          {!isConverted && (
            <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  Move status
                </div>
                <StatusChanger id={lead.id} current={lead.stage} />
              </div>
            </div>
          )}

          {/* Quick add follow-up — still allowed on converted leads */}
          <LeadFollowUpForm leadId={lead.id} />

          {/* Activity timeline */}
          <div className="rounded-[14px] bg-surface border border-rule p-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              Follow-ups ({followUps.length})
            </div>
            {followUps.length === 0 ? (
              <div className="text-[12.5px] text-text-faint">
                No follow-ups yet. Schedule one above to keep this lead warm.
              </div>
            ) : (
              <ul className="space-y-0">
                {followUps.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-baseline gap-3 border-b border-rule/60 last:border-0 py-3"
                  >
                    <span
                      className={
                        "mt-[6px] h-[8px] w-[8px] rounded-full shrink-0 " +
                        (f.status === "COMPLETED"
                          ? "bg-good"
                          : f.status === "OVERDUE"
                            ? "bg-bad"
                            : "bg-accent")
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] text-text">{f.note ?? "Untitled follow-up"}</div>
                      <div className="text-[11.5px] text-text-dim mt-0.5 tabular">
                        Due {f.dueAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                        {f.outcome ? ` · ${f.outcome.toLowerCase()}` : ""}
                      </div>
                    </div>
                    <span
                      className={
                        "text-[10.5px] uppercase tracking-[0.14em] shrink-0 " +
                        (f.status === "COMPLETED"
                          ? "text-good"
                          : f.status === "OVERDUE"
                            ? "text-bad"
                            : "text-text-dim")
                      }
                    >
                      {f.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Aside ──────────────────────────────────────────── */}
        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              At a glance
            </div>
            <dl className="space-y-3 text-[13px]">
              <Row k="Expected value" v={budgetDisplay || "—"} />
              <Row k="Source" v={SOURCE_LABEL[lead.source] ?? lead.source} />
              <Row k="Owner" v={lead.ownerId ? "Assigned" : "Unassigned"} />
              <Row k="Created" v={createdDate} />
            </dl>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-2">
              Linked records
            </div>
            <div className="text-[12.5px] text-text-faint">
              No quotations or orders yet.
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim">{k}</dt>
      <dd className="text-text tabular text-right">{v}</dd>
    </div>
  );
}
