import { notFound } from "next/navigation";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { getLead } from "@/modules/leads/queries";
import { listFollowUpsForLead } from "@/modules/followups/queries";
import { listQuotationsForClient, listLeadScopedQuotations } from "@/modules/quotations/queries";
import { listSiteVisitsForLead } from "@/modules/site-visits/queries";
import { ensureShareTokensForSending } from "@/modules/quotations/share-token";
import { LEAD_SOURCES } from "@/modules/leads/schema";
import { StatusPill } from "../_components/StatusPill";
import { StatusChanger } from "../_components/StatusChanger";
import { LeadFollowUpForm } from "../_components/LeadFollowUpForm";
import { EditableField } from "../_components/EditableField";
import { LeadDetailsCard } from "../_components/LeadDetailsCard";
import { LeadActionBar } from "../_components/LeadActionBar";
import { LeadQuotationsSidebar } from "../_components/LeadQuotationsSidebar";
import { LeadSiteVisitsSidebar } from "../_components/LeadSiteVisitsSidebar";
import { LeadMeasurementsPanel } from "../_components/LeadMeasurementsPanel";
import { listRoundsForLead, leadHasApprovedMeasurement } from "@/modules/measurement/queries-lead";
import { LeadFollowUpList } from "../_components/LeadFollowUpList";

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
  const [lead, followUps, siteVisits, rounds, isMeasured] = await Promise.all([
    getLead(ctx, id),
    listFollowUpsForLead(ctx, id),
    listSiteVisitsForLead(ctx, id),
    listRoundsForLead(ctx, id),
    leadHasApprovedMeasurement(ctx, id),
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

  // Client-scoped quotations (after conversion) vs lead-scoped (before).
  //
  // A second query used to run beside this one, pulling
  // ownerConvertApprovedAt for the two-approval Convert-to-Client card.
  // That card is gone (2026-08-28) and so is the query.
  const quotations = lead.convertedClientId
    ? await listQuotationsForClient(ctx, lead.convertedClientId)
    : await listLeadScopedQuotations(ctx, id);
  // Every still-sendable quote needs a live share token before render —
  // the lead page's inline Send builds the client's link from it.
  if (!lead.convertedClientId) await ensureShareTokensForSending(ctx, quotations);

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
                <StatusChanger
                  id={lead.id}
                  current={lead.stage}
                  leadName={lead.name}
                  mobile={lead.mobile}
                  email={lead.email ?? null}
                />
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
        canDelete={ctx.permissions.has("lead.delete")}
        isMeasured={isMeasured}
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
            <LeadFollowUpList followUps={followUps} />
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
              <Row k="Assigned to" v={lead.ownerName} />
              <Row k="Created" v={createdDate} />
              {lead.siteAddress && (
                <Row k="Site address" v={lead.siteAddress} />
              )}
            </dl>
          </div>

          <LeadQuotationsSidebar
            quotations={quotations}
            leadId={lead.id}
            isConverted={isConverted}
            leadName={lead.name}
            mobile={lead.mobile}
            email={lead.email ?? null}
          />

          {/* Measurements taken on this lead's site. These rows are
              re-pointed at the new Project by convertLead, so nothing
              measured here is re-typed after conversion. */}
          <LeadMeasurementsPanel
            leadId={lead.id}
            rounds={rounds}
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

