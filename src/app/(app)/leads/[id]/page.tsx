import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { getLead } from "@/modules/leads/queries";
import { listFollowUpsForLead } from "@/modules/followups/queries";
import { listQuotationsForClient } from "@/modules/quotations/queries";
import { QuotationsInlineTable } from "@/components/data/QuotationsInlineTable";
import { LEAD_SOURCES, BUDGET_RANGES } from "@/modules/leads/schema";
import { StatusPill } from "../_components/StatusPill";
import { StatusChanger } from "../_components/StatusChanger";
import { LeadFollowUpForm } from "../_components/LeadFollowUpForm";
import { EditableField } from "../_components/EditableField";
import { LeadDetailsCard } from "../_components/LeadDetailsCard";
import { LeadActionBar } from "../_components/LeadActionBar";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  WALK_IN: "Walk-in", PHONE: "Phone", WHATSAPP: "WhatsApp", WEBSITE: "Website",
  INSTAGRAM: "Instagram", ARCHITECT_REFERRAL: "Architect Referral", CLIENT_REFERRAL: "Client Referral",
  EXHIBITION: "Exhibition", FACEBOOK: "Facebook", GOOGLE: "Google", ADVERTISEMENT: "Advertisement",
  OTHER: "Other",
};

const SOURCE_OPTIONS = LEAD_SOURCES.map((s) => ({
  value: s,
  label: SOURCE_LABEL[s] ?? s,
}));

const BUDGET_OPTIONS = BUDGET_RANGES.map((r) => ({ value: r.value, label: r.label }));

export default async function LeadDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();

  const db = scoped(ctx);
  const [lead, followUps] = await Promise.all([
    getLead(ctx, id),
    listFollowUpsForLead(ctx, id),
  ]);
  if (!lead) notFound();

  let convertedProjectId: string | null = null;
  if (lead.convertedClientId) {
    const proj = await db.project.findFirst({
      where: { clientId: lead.convertedClientId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    convertedProjectId = proj?.id ?? null;
  }

  const quotations = lead.convertedClientId
    ? await listQuotationsForClient(ctx, lead.convertedClientId)
    : [];

  const createdDate = lead.createdAt.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
  const budgetDisplay = lead.budgetMax ? formatINR(lead.budgetMax) : "";
  const budgetLabel = lead.budgetRangeSlug
    ? (BUDGET_RANGES.find((r) => r.value === lead.budgetRangeSlug)?.label ?? lead.budgetRangeSlug)
    : "";
  const isConverted = lead.convertedClientId != null;

  return (
    <>
      {/* ── Hero ── */}
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
          <div className="shrink-0">
            <StatusPill status={lead.stage} />
          </div>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <LeadActionBar
        leadId={lead.id}
        stage={lead.stage}
        convertedClientId={lead.convertedClientId}
        convertedProjectId={convertedProjectId}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        {/* ── Main column ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {isConverted && (
            <div className="rounded-[14px] bg-good/8 border border-good/30 p-4 text-[12.5px] text-text">
              This lead has been converted to a client. Edits here won&apos;t sync — update the client record instead.
            </div>
          )}

          {/* Editable info card */}
          <LeadDetailsCard
            leadId={lead.id}
            mobile={lead.mobile.replace(/^\+91/, "")}
            mobileFull={lead.mobile}
            email={lead.email ?? ""}
            source={lead.source}
            sourceLabel={SOURCE_LABEL[lead.source] ?? lead.source}
            budgetRange={lead.budgetRangeSlug ?? ""}
            budgetLabel={budgetLabel}
            requirement={lead.requirement ?? ""}
            sourceOptions={SOURCE_OPTIONS}
            budgetOptions={BUDGET_OPTIONS}
            isConverted={isConverted}
          />

          {/* Status quick-change — hidden once converted */}
          {!isConverted && (
            <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center gap-3 flex-wrap">
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Move status</div>
              <StatusChanger id={lead.id} current={lead.stage} />
            </div>
          )}

          {/* Quotations */}
          <QuotationsInlineTable
            rows={quotations}
            emptyHint={
              isConverted
                ? "No quotations yet. Use Quick Quote above to create one."
                : "Convert this lead to a client first, then send a quotation."
            }
            {...(isConverted ? { seeAllHref: "/quotations" as const } : {})}
          />

          {/* Follow-up & Activity — anchor for the action bar */}
          <div id="follow-up" className="rounded-[14px] bg-surface border border-rule p-6 scroll-mt-4">
            <LeadFollowUpForm leadId={lead.id} />
          </div>

          {/* Timeline */}
          <div className="rounded-[14px] bg-surface border border-rule p-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              Follow-ups &amp; activity ({followUps.length})
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
                        Due {f.dueAt.toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
                        })}
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

          {/* Documents — anchor for the action bar */}
          <div id="documents" className="rounded-[14px] bg-surface border border-rule p-6 scroll-mt-4">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              Documents
            </div>
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center">
                <Paperclip size={18} strokeWidth={1.5} className="text-text-dim" />
              </div>
              <div className="text-[13px] text-text-dim">No documents yet</div>
              <p className="text-[11.5px] text-text-faint max-w-[260px]">
                Attach drawings, client approvals, site photos, and contracts here.
              </p>
            </div>
          </div>
        </div>

        {/* ── Aside ──────────────────────────────────────────── */}
        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              At a glance
            </div>
            <dl className="space-y-3 text-[13px]">
              <Row k="Expected value" v={budgetLabel || budgetDisplay || "—"} />
              <Row k="Source" v={SOURCE_LABEL[lead.source] ?? lead.source} />
              <Row k="Owner" v={lead.ownerName} />
              <Row k="Created" v={createdDate} />
            </dl>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-2">
              Linked records
            </div>
            <dl className="space-y-2 text-[12.5px]">
              <Row k="Quotations" v={quotations.length ? String(quotations.length) : "—"} />
              <Row k="Project" v={convertedProjectId ? "1" : "—"} />
            </dl>
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
