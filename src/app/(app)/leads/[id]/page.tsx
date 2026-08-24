import { notFound } from "next/navigation";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { getLead } from "@/modules/leads/queries";
import { listFollowUpsForLead } from "@/modules/followups/queries";
import { listQuotationsForClient, listLeadScopedQuotations } from "@/modules/quotations/queries";
import { listSiteVisitsForLead } from "@/modules/site-visits/queries";
import { LEAD_SOURCES } from "@/modules/leads/schema";
import { StatusPill } from "../_components/StatusPill";
import { StatusChanger } from "../_components/StatusChanger";
import { LeadFollowUpForm } from "../_components/LeadFollowUpForm";
import { EditableField } from "../_components/EditableField";
import { LeadDetailsCard } from "../_components/LeadDetailsCard";
import { LeadActionBar } from "../_components/LeadActionBar";
import { ConversionApprovalCard, type LeadScopedQuote } from "../_components/ConversionApprovalCard";
import { LeadQuotationsSidebar } from "../_components/LeadQuotationsSidebar";
import { LeadSiteVisitsSidebar } from "../_components/LeadSiteVisitsSidebar";

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

export default async function LeadDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();

  const db = scoped(ctx);
  const [lead, followUps, siteVisits] = await Promise.all([
    getLead(ctx, id),
    listFollowUpsForLead(ctx, id),
    listSiteVisitsForLead(ctx, id),
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

  // Client-scoped quotations (after conversion) vs lead-scoped (before)
  const [quotations, leadScopedQuoteRows] = await Promise.all([
    lead.convertedClientId
      ? listQuotationsForClient(ctx, lead.convertedClientId)
      : listLeadScopedQuotations(ctx, id),
    // FIXES-01 §5.1 — fetch lead-scoped quotes separately for the
    // two-approval Convert-to-Client card (needs ownerConvertApprovedAt).
    lead.convertedClientId
      ? Promise.resolve([] as { id: string; number: string; status: string; total: bigint; ownerConvertApprovedAt: Date | null }[])
      : db.quotation.findMany({
          where:   { leadId: id },
          orderBy: { date: "desc" },
          select:  {
            id: true, number: true, status: true, total: true,
            ownerConvertApprovedAt: true,
          },
        }),
  ]);
  const leadScopedQuotes: LeadScopedQuote[] = leadScopedQuoteRows.map((q) => ({
    id:     q.id,
    number: q.number,
    status: q.status,
    total:  q.total.toString(),
    ownerConvertApprovedAt: q.ownerConvertApprovedAt?.toISOString() ?? null,
  }));

  const createdDate = lead.createdAt.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
  const budgetDisplayStr = lead.budgetMax ? formatINR(lead.budgetMax) : "";
  const budgetEditStr = lead.budgetMax != null
    ? String(Number(lead.budgetMax) / 100)
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
          <div className="shrink-0 flex items-center gap-2">
            {isConverted ? (
              <StatusPill status={lead.stage} />
            ) : (
              <>
                <span className="text-[11px] uppercase tracking-[0.1em] text-text-dim">Move Status</span>
                <StatusChanger id={lead.id} current={lead.stage} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <LeadActionBar
        leadId={lead.id}
        stage={lead.stage}
        convertedClientId={lead.convertedClientId}
        convertedProjectId={convertedProjectId}
        leadName={lead.name}
        mobile={lead.mobile}
        email={lead.email ?? null}
        hasQuotes={leadScopedQuotes.length > 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        {/* ── Main column ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {isConverted && (
            <div className="rounded-[14px] bg-good/8 border border-good/30 p-4 text-[12.5px] text-text">
              This lead has been converted to a client. Edits here won&apos;t sync — update the client record instead.
            </div>
          )}

          {/* Two-approval Convert-to-Client card — FIXES-01 §5.1 */}
          {!isConverted && leadScopedQuotes.length > 0 && (
            <ConversionApprovalCard
              leadId={lead.id}
              leadName={lead.name}
              mobile={lead.mobile}
              email={lead.email ?? null}
              quotes={leadScopedQuotes}
            />
          )}

          {/* Editable info card */}
          <LeadDetailsCard
            leadId={lead.id}
            mobile={lead.mobile.replace(/^\+91/, "")}
            mobileFull={lead.mobile}
            email={lead.email ?? ""}
            source={lead.source}
            sourceLabel={SOURCE_LABEL[lead.source] ?? lead.source}
            budgetDisplayStr={budgetDisplayStr}
            budgetEditStr={budgetEditStr}
            requirement={lead.requirement ?? ""}
            sourceOptions={SOURCE_OPTIONS}
            isConverted={isConverted}
          />

          {/* Follow-up & Activity — anchor for the action bar */}
          <div id="follow-up" className="rounded-[14px] bg-surface border border-rule p-6 scroll-mt-4">
            <LeadFollowUpForm leadId={lead.id} />
          </div>

          {/* Timeline */}
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

        </div>

        {/* ── Aside ──────────────────────────────────────────── */}
        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              At a glance
            </div>
            <dl className="space-y-3 text-[13px]">
              <Row k="Estimated budget" v={budgetDisplayStr || "—"} />
              <Row k="Source" v={SOURCE_LABEL[lead.source] ?? lead.source} />
              <Row k="Owner" v={lead.ownerName} />
              <Row k="Created" v={createdDate} />
              {lead.siteAddress && (
                <div>
                  <dt className="text-text-dim mb-1">Site address</dt>
                  <dd className="text-text whitespace-pre-wrap leading-snug">{lead.siteAddress}</dd>
                </div>
              )}
            </dl>
          </div>

          <LeadQuotationsSidebar
            quotations={quotations}
            leadId={lead.id}
            isConverted={isConverted}
          />

          <LeadSiteVisitsSidebar visits={siteVisits} />
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

