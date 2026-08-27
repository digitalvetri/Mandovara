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

import {
  Ruler, Package, Wallet, Hammer, Flag, ListChecks, TrendingUp, MapPin,
} from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { SiteVisitRow } from "@/modules/site-visits/queries";
import type { ProjectLedger } from "@/modules/projects/queries-ledger";
import type { ProjectInstallation } from "@/modules/projects/queries-installation";
import type {
  ProjectMilestone, ProjectTask, ProjectMember, ProjectMeasurementRow,
} from "@/modules/projects/queries-detail";
import type { ProjectChosenItem } from "@/modules/projects/queries-detail-money-payments";
import type { ProjectPayments } from "@/modules/projects/queries-detail-money-payments";
import type { ProjectProfitability } from "@/modules/reports/profitability";
import { ProjectSection } from "./ProjectSection";
import { PaymentLedgerPanel } from "./PaymentLedgerPanel";
import { InstallationPanel } from "./InstallationPanel";
import { MilestonesPanel } from "./MilestonesPanel";
import { MeasurementsSection } from "./MeasurementsSection";
import { CollapsedPanels } from "./CollapsedPanels";
import { PaymentsPanel } from "./PaymentsPanel";
import { ChosenItemsPanel } from "./ChosenItemsPanel";
import { ProfitabilityPanel } from "./ProfitabilityPanel";
import { UpcomingVisitsCard } from "./UpcomingVisitsCard";
import { CreateInvoiceHeaderButton } from "./CreateInvoiceHeaderButton";

interface Props {
  projectId:        string;
  orderValue:       bigint;
  rounds:           ProjectMeasurementRow[];
  chosen:           ProjectChosenItem[];
  ledger:           ProjectLedger;
  payments:         ProjectPayments | null;
  installation:     ProjectInstallation;
  milestones:       ProjectMilestone[];
  visits:           SiteVisitRow[];
  tasks:            ProjectTask[];
  members:          ProjectMember[];
  profitability:    ProjectProfitability | null;
  canCreateInvoice: boolean;
  canUpdate:        boolean;
}

export function ProjectWorkSections({
  projectId, orderValue, rounds, chosen, ledger, payments, installation,
  milestones, visits, tasks, members, profitability,
  canCreateInvoice, canUpdate,
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

  const installSummary = installation.totalLines === 0
    ? "No order yet"
    : installation.pct === 100
      ? `All ${installation.totalLines} items installed`
      : `${installation.doneLines} of ${installation.totalLines} items · ${installation.pct}%`;

  const doneMilestones = milestones.filter((m) => m.status === "DONE" || m.actualDate != null).length;
  const milestoneSummary = milestones.length === 0
    ? "None set"
    : `${doneMilestones} of ${milestones.length} complete`;

  const openTasks = tasks.filter((t) => t.status !== "DONE").length;
  const taskSummary = tasks.length === 0
    ? "No tasks"
    : openTasks === 0 ? "All done" : `${openTasks} open`;

  // Order follows how the work actually runs, but nothing here gates
  // anything else — every section is reachable at any time.
  return (
    <div className="space-y-2.5">

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

        <ProjectSection
          icon={<Package size={13} />}
          title="Materials chosen"
          count={chosen.length}
          summary={chosen.length === 0 ? "Nothing selected yet" : `${chosen.length} item${chosen.length === 1 ? "" : "s"} selected`}
        >
          <ChosenItemsPanel items={chosen} />
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
          action={payments?.latestOrderId && canCreateInvoice
            ? <CreateInvoiceHeaderButton orderId={payments.latestOrderId} />
            : undefined}
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

        <ProjectSection
          icon={<Hammer size={13} />}
          title="Installation"
          summary={installSummary}
          tone={installation.totalLines > 0 && installation.pct === 100 ? "good" : "neutral"}
        >
          <InstallationPanel
            data={installation}
            projectId={projectId}
            canEdit={canUpdate}
          />
        </ProjectSection>

        <ProjectSection
          icon={<Flag size={13} />}
          title="Milestones"
          count={milestones.length}
          summary={milestoneSummary}
        >
          <MilestonesPanel milestones={milestones} orderValue={orderValue} />
        </ProjectSection>

        <ProjectSection
          icon={<MapPin size={13} />}
          title="Site visits"
          count={visits.length}
          summary={visits.length === 0 ? "None scheduled" : `${visits.length} recorded`}
        >
          <UpcomingVisitsCard visits={visits} showAll />
        </ProjectSection>

        <ProjectSection
          icon={<ListChecks size={13} />}
          title="Tasks"
          count={tasks.length}
          summary={taskSummary}
          tone={openTasks > 0 ? "warn" : "neutral"}
        >
          <CollapsedPanels projectId={projectId} tasks={tasks} members={members} />
        </ProjectSection>

        {profitability && (
          <ProjectSection
            icon={<TrendingUp size={13} />}
            title="Profitability"
            summary="Cost, margin and expenses"
            tone="accent"
          >
            <ProfitabilityPanel data={profitability} />
          </ProjectSection>
      )}

    </div>
  );
}
