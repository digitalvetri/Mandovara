// The job, listed.
//
// Split out of the project page (2026-08-27) when the section list
// pushed it past CLAUDE.md §10's 300-line ceiling. Everything about WHY
// the page is a list rather than a flow is documented on the page and on
// ProjectSection; this file is the arrangement.
//
// The collapsed-state summary strings live here too, next to the
// sections that show them, so a summary can never quietly stop matching
// the panel underneath it.
//
// Milestones, Tasks, Profitability and Materials chosen were removed
// from this list per user feedback (2026-08-28). The underlying models
// and queries are kept — Reports still reads profitability, milestones
// are still generated, and chosen items still come off the order — they
// are simply not surfaced on the project detail page. Their panels
// (MilestonesPanel, CollapsedPanels / ProjectPanels, ProfitabilityPanel,
// ChosenItemsPanel) remain in this folder in case the sections return.

import { Ruler, Wallet, MapPin } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { SiteVisitRow } from "@/modules/site-visits/queries";
import type { ProjectLedger } from "@/modules/projects/queries-ledger";
import type { ProjectMeasurementRow } from "@/modules/projects/queries-detail";
import type { ProjectPayments } from "@/modules/projects/queries-detail-money-payments";
import { ProjectSection } from "./ProjectSection";
import { PaymentLedgerPanel } from "./PaymentLedgerPanel";
import { MeasurementsSection } from "./MeasurementsSection";
import { PaymentsPanel } from "./PaymentsPanel";
import { UpcomingVisitsCard } from "./UpcomingVisitsCard";
import { RecordPaymentFromProject } from "./RecordPaymentFromProject";
import { CreateInvoiceLink } from "./CreateInvoiceLink";

interface Props {
  projectId:        string;
  rounds:           ProjectMeasurementRow[];
  ledger:           ProjectLedger;
  payments:         ProjectPayments | null;
  visits:           SiteVisitRow[];
  /** For recording a receipt straight from the ledger. */
  clientId:         string;
  branchId:         string;
  canCreateInvoice: boolean;
  /** Accepted so the page needs no change; unread since the Installation
   *  section (its only consumer) left on 2026-08-30. */
  canUpdate?:       boolean;
}

export function ProjectWorkSections({
  projectId, rounds, ledger, payments, visits, clientId, branchId,
  canCreateInvoice,
}: Props) {
  // Each section states where it stands without being opened. These
  // carry real numbers — never a placeholder like "view details".
  const approvedRounds = rounds.filter((r) => r.status === "APPROVED").length;
  const measurementSummary = rounds.length === 0
    ? "Not measured yet"
    : approvedRounds > 0
      ? `${approvedRounds} approved of ${rounds.length} round${rounds.length === 1 ? "" : "s"}`
      : `${rounds.length} round${rounds.length === 1 ? "" : "s"}, none approved`;

  const ledgerSummary = ledger.invoiced === 0n && ledger.received === 0n
    ? (ledger.quoted > 0n ? `${formatINR(ledger.quoted)} quoted, nothing invoiced` : "No money yet")
    : ledger.balance > 0n
      ? `${formatINR(ledger.received)} of ${formatINR(ledger.invoiced)} received`
      : ledger.balance === 0n
        ? `Fully paid — ${formatINR(ledger.received)}`
        : `In credit by ${formatINR(-ledger.balance)}`;
  const ledgerTone = ledger.balance > 0n ? "warn" : ledger.received > 0n ? "good" : "neutral";

  // Order follows how the work actually runs, but nothing here gates
  // anything else — every section is reachable at any time.
  return (
    <div className="space-y-2">

        <ProjectSection
          icon={<Ruler size={13} />}
          title="Measurements"
          count={rounds.length}
          summary={measurementSummary}
          tone={rounds.length === 0 ? "warn" : "neutral"}
          defaultOpen={rounds.length > 0}
        >
          <MeasurementsSection projectId={projectId} rounds={rounds} />
        </ProjectSection>

        {/* The ledger the owner asked for: quotation, advances,
            invoices and receipts in one running statement. */}
        <ProjectSection
          icon={<Wallet size={13} />}
          title="Payment ledger"
          count={ledger.rows.length}
          summary={ledgerSummary}
          tone={ledgerTone}
          defaultOpen={ledger.rows.length > 0}
          action={
            <div className="flex items-center gap-2">
              {canCreateInvoice && (
                <RecordPaymentFromProject
                  clientId={clientId}
                  branchId={branchId}
                  openInvoices={(payments?.invoices ?? [])
                    .filter((i) => i.outstanding > 0n)
                    .map((i) => ({
                      id: i.id, number: i.number,
                      outstanding: i.outstanding.toString(),
                    }))}
                />
              )}
              {/* One control, always the same: write the invoice. An
                  order-backed one-click still exists on the order page. */}
              {canCreateInvoice && <CreateInvoiceLink projectId={projectId} />}
            </div>
          }
        >
          <PaymentLedgerPanel ledger={ledger} />
          {payments && (
            <div className="mt-4 border-t border-rule pt-4">
              <PaymentsPanel
                payments={payments}
                canCreate={canCreateInvoice}
              />
            </div>
          )}
        </ProjectSection>

        {/* The Installation section stood here. Removed 2026-08-30
            (owner) — it could only ever say "No order yet" on a studio
            that does not run orders, and a section that never has
            anything in it is a section people learn to scroll past.
            InstallationPanel and getProjectInstallation are untouched. */}

        <ProjectSection
          icon={<MapPin size={13} />}
          title="Site visits"
          count={visits.length}
          summary={visits.length === 0 ? "None scheduled" : `${visits.length} recorded`}
        >
          <UpcomingVisitsCard visits={visits} showAll />
        </ProjectSection>

    </div>
  );
}
