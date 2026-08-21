import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { FileText, Plus } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { getLead } from "@/modules/leads/queries";
import { listFollowUpsForLead } from "@/modules/followups/queries";
import { listQuotationsForClient, listLeadScopedQuotations } from "@/modules/quotations/queries";
import { LEAD_SOURCES } from "@/modules/leads/schema";
import { StatusPill } from "../_components/StatusPill";
import { StatusChanger } from "../_components/StatusChanger";
import { LeadFollowUpForm } from "../_components/LeadFollowUpForm";
import { EditableField } from "../_components/EditableField";
import { LeadDetailsCard } from "../_components/LeadDetailsCard";
import { LeadActionBar } from "../_components/LeadActionBar";
import { ConversionApprovalCard, type LeadScopedQuote } from "../_components/ConversionApprovalCard";

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

          {/* Quotations panel */}
          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-rule">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
                Quotations
                {quotations.length > 0 && (
                  <span className="ml-1.5 tabular text-[10px] text-text-faint">({quotations.length})</span>
                )}
              </div>
              {!isConverted && (
                <Link
                  href={`/quotations/new?lead=${lead.id}` as Route}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                >
                  <Plus size={11} strokeWidth={2.2} />
                  New
                </Link>
              )}
            </div>

            {quotations.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <FileText size={18} className="mx-auto mb-2 text-text-faint" />
                <div className="text-[12px] text-text-dim mb-3">No quotations yet.</div>
                {!isConverted && (
                  <Link
                    href={`/quotations/new?lead=${lead.id}` as Route}
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-accent px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    <Plus size={11} strokeWidth={2.2} />
                    New quotation
                  </Link>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-rule">
                {quotations.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/quotations/${q.id}` as Route}
                      className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-surface-2/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="tabular text-[12.5px] font-medium text-accent">
                          {shortQtNumber(q.number)}
                          {q.revision > 0 && (
                            <span className="ml-1 text-[10px] text-text-faint">v{q.revision}</span>
                          )}
                        </div>
                        <div className="tabular text-[11px] text-text-dim mt-0.5">
                          {formatINR(q.total)}
                        </div>
                      </div>
                      <QuoteSidebarPill status={q.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
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

function shortQtNumber(n: string): string {
  const parts = n.split("/");
  return parts.length >= 2 ? (parts.slice(-1)[0] ?? n) : n;
}

const QT_STATUS_TONE: Record<string, string> = {
  DRAFT:            "bg-text-dim/12 text-text-dim",
  SENT:             "bg-info/15 text-info",
  ACCEPTED:         "bg-solid/12 text-solid",
  REJECTED:         "bg-fault/12 text-fault",
  EXPIRED:          "bg-fault/12 text-fault",
  REVISED:          "bg-heat/15 text-heat",
  PENDING_APPROVAL: "bg-heat/15 text-heat",
};

function QuoteSidebarPill({ status }: { status: string }) {
  const tone = QT_STATUS_TONE[status] ?? "bg-text-dim/12 text-text-dim";
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <span className={`shrink-0 inline-block text-[10px] font-medium uppercase tracking-[0.05em] px-2 py-0.5 rounded-[3px] ${tone}`}>
      {label}
    </span>
  );
}
