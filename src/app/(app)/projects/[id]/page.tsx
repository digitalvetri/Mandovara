// Project detail — the project workspace.
//
// Restructured 2026-08-27 on the owner's instruction. It used to lead
// with a single "next action" and read as a wizard: quote, then advance,
// then installation, then completion, each waiting on the last. Real
// projects don't behave — the advance lands before the final quote is
// approved, one room is installed while another is still being measured
// — so the sequence hid whatever you actually needed behind a step you
// hadn't done.
//
// Now every part of the job is a section in a list. Closed, a section
// states where it stands ("₹2,40,000 of ₹6,50,000 received"); open, it
// shows the detail. Nothing is gated, several can be open at once, and
// the page reads top-to-bottom as a status board.
//
// Layout:
//   ┌ header: project number · name · stage stepper · figures
//   │
//   ├ 2-col grid
//   │   left  : quick actions, then one section per part of the job
//   │   right : Client · Site · Money (permission-gated) · Team  (sticky)
//
// Data (§7 — money block gate): getProjectMoney() returns null when the
// user's permissions don't cover margin/outstanding, so the row IDs and
// paisa values never leave the DB for those roles.

import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { shortNumber } from "@/lib/short-number";
import { devContext } from "@/lib/dev-context";
import {
  getProject, getProjectMeasurements, getProjectMoney,
  getProjectPayments,
} from "@/modules/projects/queries";
import { listSiteVisits } from "@/modules/site-visits/queries";
import { resolveNextAction } from "@/modules/projects/next-action";
import { StageStepper } from "../_components/StageStepper";
import { RightRail } from "../_components/RightRail";
import { StartMeasurementFlow } from "../_components/StartMeasurementFlow";
import { CreateInvoiceHeaderButton } from "../_components/CreateInvoiceHeaderButton";
import { ProjectWorkSections } from "../_components/ProjectWorkSections";
import { MarkCompleteButton } from "../_components/MarkCompleteButton";
import { DeleteProjectAction } from "../_components/DeleteProjectAction";
import { getProjectDeleteBlockers } from "@/modules/projects/actions-delete";
import type { DeleteBlocker } from "@/modules/projects/delete-shared";
import { getProjectLedger } from "@/modules/projects/queries-ledger";
import { AttachmentsCard } from "@/components/documents/AttachmentsCard";
import { listAttachments } from "@/modules/documents/queries";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const p = await getProject(ctx, id);
  if (!p) notFound();

  const [rounds, money, visits, payments, ledger, attachments] =
    await Promise.all([
      getProjectMeasurements(ctx, id),
      getProjectMoney(ctx, id),
      listSiteVisits(ctx, { projectId: id, limit: 10 }),
      getProjectPayments(ctx, id),
      getProjectLedger(ctx, id),
      listAttachments(ctx, "PROJECT", id),
    ]);

  // What stands in the way of deleting this project — money and stock
  // rows, chiefly. Loaded here so the confirm dialog can explain the
  // refusal before the click rather than after it. Only fetched when the
  // user could act on it; the action re-checks server-side regardless.
  const canDelete = ctx.permissions.has("project.delete");
  const deleteBlockers: DeleteBlocker[] = canDelete
    ? await getProjectDeleteBlockers(id)
    : [];

  const action = resolveNextAction(ctx, {
    id:       p.id,
    clientId: p.clientId,
    stage:    p.stage,
    hasQuotation: ledger.quoted > 0n,
    ...(money ? { money: {
      invoiceTotal:    money.invoiceTotal,
      advanceReceived: money.advanceReceived,
      advanceRequired: money.advanceRequired,
      agreedValue:     money.orderValue,
      outstanding:     money.outstanding,
    } } : {}),
  });
  // What the client committed to. Both getProjectMoney and getProjectLedger
  // now read it from getProjectReceivable, so they agree by construction;
  // the stored column is the last resort for projects that predate the
  // quotation-first flow.
  const headerAgreedValue =
    (money?.orderValue ?? 0n) > 0n ? money!.orderValue
    : ledger.quoted > 0n           ? ledger.quoted
    : p.orderValue;

  return (
    <>
      <Topbar
        title=""
        eyebrow=""
      />

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="mb-4 rounded-[14px] border border-rule bg-surface p-5">
        {/* Row 1 — meta + primary action (right-aligned)
            Stacks on a phone. "Edit" and "Create quotation" together are
            about 205px of the 350px a 390px screen leaves inside this card,
            so side by side they squeezed the heading into ~145px: the
            project number broke across three lines and the name across
            four. They get their own row below the title instead. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] uppercase tracking-[0.14em] text-text-dim">
              <span className="tabular-nums">{shortNumber(p.number, "P-")}</span>
              <span aria-hidden>·</span>
              <span>{formatDate(p.createdAt)}</span>
            </div>

            <h1 className="font-display text-[22px] font-semibold leading-[1.05] tracking-[-0.015em] text-text sm:text-[30px]">
              {p.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ctx.permissions.has("project.update") && (
              <a
                href={`/projects/${p.id}/edit`}
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-rule bg-surface-2 px-3 text-[12px] text-text-dim hover:border-gold hover:text-text transition-colors"
              >
                Edit
              </a>
            )}
            {/* Create quotation — jumps to /quotations/new pre-scoped to
                this project. Hidden on terminal stages so completed /
                cancelled projects don't accumulate more quotes. */}
            {ctx.permissions.has("quotation.create") &&
              p.stage !== "COMPLETED" && p.stage !== "CANCELLED" && (
              <a
                href={`/quotations/new?project=${p.id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-accent/40 bg-accent/8 px-3 text-[12px] font-medium text-accent hover:bg-accent/15 transition-colors"
              >
                Create quotation
              </a>
            )}
            {/* Billing is the LAST step of a job here, so the invoice button
                waits for the money: nothing invoiced yet, and the quotation
                paid off. Before that it is not a missing button but a step
                that has not arrived, and the row above says why. With an
                order it bills from the order; without one it opens the
                builder seeded from the quotation. Both re-check the same
                rule server-side (invoices/project-gate.ts). */}
            {ctx.permissions.has("invoice.create") &&
              (payments?.invoices.length ?? 0) === 0 &&
              ledger.settled && (
              payments?.latestOrderId
                ? <CreateInvoiceHeaderButton orderId={payments.latestOrderId} />
                : <a
                    href={`/invoicing/create?project=${p.id}`}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-gold px-4 py-2 text-[12.5px] font-semibold text-ink shadow-sm transition-all hover:bg-gold-strong hover:-translate-y-[1px]"
                  >
                    Create invoice
                  </a>
            )}
            {/* Finishing the job. Not a stepper dot — see
                MarkCompleteButton for why the stepper cannot reach
                Completed on a project that never had a firm quote. */}
            {ctx.permissions.has("project.update") && (
              <MarkCompleteButton projectId={p.id} stage={p.stage} />
            )}
            {/* Deleting is for a project that should never have existed
                — a duplicate, or one typed against the wrong client. A
                project with invoices, receipts or stock behind it
                refuses and points at Cancel instead; the dialog says so
                before the click. */}
            {canDelete && (
              <DeleteProjectAction
                projectId={p.id}
                projectName={p.name}
                blockers={deleteBlockers}
              />
            )}
          </div>
        </div>

        <div className="mt-3.5">
          <StageStepper
            stage={p.stage}
            projectId={p.id}
            canEdit={ctx.permissions.has("project.update")}
            money={money ? {
              invoiceTotal:    money.invoiceTotal,
              advanceReceived: money.advanceReceived,
              advanceRequired: money.advanceRequired,
            } : null}
            hasOrder={Boolean(payments?.latestOrderId)}
          />
        </div>

        {/* Three figures, from ONE source.
        
            This row used to read Project.orderValue — a stored column
            nothing keeps up to date — while the money rail two hundred
            pixels to the right computed its own total from the actual
            orders. A real project showed "ORDER VALUE ₹0" beside
            "Order ₹1,230". Whichever an owner believed, the screen was
            lying to them somewhere.
            
            Everything here now comes from the ledger, which is also what
            the rail and the Payment ledger section read, so the three
            cannot disagree. "Progress" is replaced by balance due:
            percentage-of-milestones read 0% on a project that was
            invoiced and paid in full, which told nobody anything. */}
        {/* Quoted → Received → Still to collect. The client agreed a figure;
            what they have paid comes off it; the rest is what to chase. That
            is the whole money story of a job in this studio, and it is the
            same three numbers the Money page counts. This row used to read
            "Order value / Received / Balance due", where the balance came
            from invoices — so a job quoted at ₹4 lakh with an advance paid
            and no invoice yet reported nothing due. */}
        <div className="mt-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[12.5px] tabular-nums text-text-dim">
          <HeaderStat k="Quoted" v={formatINR(headerAgreedValue)} />
          <HeaderStat k="Received" v={formatINR(ledger.received)} />
          <HeaderStat
            k={ledger.balance >= 0n ? "Still to collect" : "In credit"}
            v={formatINR(ledger.balance >= 0n ? ledger.balance : -ledger.balance)}
          />
        </div>
      </div>

      {/* ── Body — 2-column grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 pb-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <StartMeasurementFlow
            projectId={p.id}
            action={action}
            currentUserId={ctx.userId}
            canScheduleVisit={
              ctx.permissions.has("project.update") ||
              ctx.permissions.has("sitelog.create")
            }
            canMeasure={
              ctx.permissions.has("measurement.create.any") ||
              ctx.permissions.has("measurement.create.own") ||
              ctx.permissions.has("measurement.create")
            }
            canInvoice={ctx.permissions.has("invoice.create")}
            quickActionsVisible={
              p.stage !== "COMPLETED" && p.stage !== "CANCELLED"
            }
          />
          <ProjectWorkSections
            projectId={p.id}
            rounds={rounds}
            ledger={ledger}
            payments={payments}
            visits={visits}
            clientId={p.clientId}
            branchId={p.branchId}
            canCreateInvoice={ctx.permissions.has("invoice.create")}
            canUpdate={ctx.permissions.has("project.update")}
          />

          {/* Site photos and drawings for the project, alongside the ones
              captured against individual measurement items. */}
          <AttachmentsCard
            ownerType="PROJECT"
            ownerId={p.id}
            rows={attachments}
            canEdit={ctx.permissions.has("project.update")}
            title="Site photos & files"
            hint="Site shots, drawings and documents for this project."
            defaultCategory="SITE_SHOT"
          />
        </div>

        <RightRail project={p} money={money} />
      </div>
    </>
  );
}

function HeaderStat({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-subtle">{k}</span>
      <span className="text-text">{v}</span>
    </span>
  );
}
