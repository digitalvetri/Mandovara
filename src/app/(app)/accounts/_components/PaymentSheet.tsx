"use client";

// The payment recorder per docs/ACCOUNTS-PAGE.md §8.
// Client → What for → Amount → Mode → Save. Client is picked from the URL
// (?clientId=X) or via the picker at the top when opened directly.
//
// "What for" was added 2026-09-10 and is the point of the screen. The studio
// quotes, the client agrees, money arrives against that agreement, and the
// tax invoice is raised at the end. So the usual target of a payment is a
// JOB, not a bill — and the sheet, which only ever offered bills, had
// nothing to attach the money to. Every advance went in unattached and
// Accounts → Received listed it as "not matched to a bill".
//
// When the target is a job the receipt carries its projectId and the money
// counts straight off that project's balance. When it is the client's open
// bills, the old behaviour is unchanged: auto-allocate oldest-first, with
// "Change" for per-bill tweaking.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { createReceipt } from "@/modules/receipts/actions";
import type { PaymentMode } from "@/modules/receipts/schema";
import type { ClientForReceiptOption } from "@/modules/receipts/queries";
import type { BranchOption } from "@/modules/branches/queries";
import {
  safePaise, iso, toOpenProjects,
  type OutstandingInvoiceWire, type OpenProject, type OpenProjectWire, type PaymentTarget,
} from "./_receipt-primitives";
import { PaymentSheetPreview } from "./PaymentSheetPreview";
import { PaymentSheetMode } from "./PaymentSheetMode";
import { PaymentSheetTarget } from "./PaymentSheetTarget";
import { PaymentSheetClient } from "./PaymentSheetClient";
import { PaymentSheetAmount } from "./PaymentSheetAmount";

interface Props {
  clients:            ClientForReceiptOption[];
  branches:           BranchOption[];
  initialClientId?:   string;
  /** Pre-loaded outstanding rows for the initial client — skips the first fetch. */
  initialOutstanding?: OutstandingInvoiceWire[];
  /** Pre-loaded open jobs for the initial client — same reason. */
  initialProjects?:   OpenProjectWire[];
}

interface OutstandingBills {
  id:         string;
  number:     string;
  date:       Date;
  dueDate:    Date;
  outstanding: bigint;
}

function toWire(rows: OutstandingInvoiceWire[]): OutstandingBills[] {
  return rows.map((r) => ({
    id:          r.id,
    number:      r.number,
    date:        new Date(r.date),
    dueDate:     new Date(r.dueDate),
    outstanding: BigInt(r.outstanding),
  }));
}

export function PaymentSheet({
  clients, branches, initialClientId, initialOutstanding, initialProjects,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>(initialClientId ?? "");
  const [bills, setBills] = useState<OutstandingBills[]>(() =>
    initialClientId && initialOutstanding ? toWire(initialOutstanding) : []);
  const [projects, setProjects] = useState<OpenProject[]>(() =>
    initialClientId && initialProjects ? toOpenProjects(initialProjects) : []);
  const [target, setTarget] = useState<PaymentTarget | null>(null);
  const [loadingBills, setLoadingBills] = useState(false);

  // Refetch the client's jobs and bills together whenever the client changes
  // (skip the initial one — already loaded server-side).
  useEffect(() => {
    if (!clientId) { setBills([]); setProjects([]); setTarget(null); return; }
    if (clientId === initialClientId && initialProjects && initialOutstanding) return;
    setLoadingBills(true);
    fetch(`/api/receipts/targets?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d: { bills: OutstandingInvoiceWire[]; projects: OpenProjectWire[] }) => {
        setBills(toWire(d.bills ?? []));
        setProjects(toOpenProjects(d.projects ?? []));
      })
      .finally(() => setLoadingBills(false));
  }, [clientId, initialClientId, initialOutstanding, initialProjects]);

  const billsTotal = useMemo(() => bills.reduce((s, b) => s + b.outstanding, 0n), [bills]);

  // Default to the oldest open job — the one the client is most likely
  // paying for. Falls back to their bills when there is no open job.
  useEffect(() => {
    if (target != null) return;
    if (projects.length > 0) { setTarget({ kind: "project", projectId: projects[0]!.id }); return; }
    if (bills.length   > 0) { setTarget({ kind: "bills" }); }
  }, [projects, bills, target]);

  // Reset the choice when the client changes, so a job belonging to the
  // previous client can never stay selected.
  useEffect(() => { setTarget(null); }, [clientId]);

  const selectedProject = target?.kind === "project"
    ? projects.find((p) => p.id === target.projectId) ?? null
    : null;

  /** What the chosen target is short by — what "Full" fills in. */
  const fullOutstanding = selectedProject ? selectedProject.due
    : target?.kind === "bills" ? billsTotal
    : 0n;

  const [amount, setAmount] = useState<string>("");
  useEffect(() => {
    // Pre-fill with the target's balance — the user can override. Only keyed
    // on fullOutstanding so a figure the user has typed is never overwritten.
    if (fullOutstanding > 0n && amount === "") {
      setAmount((Number(fullOutstanding) / 100).toString());
    }
  }, [fullOutstanding]);

  const totalPaise = safePaise(amount);
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [reference, setReference] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>(iso(new Date()));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualAlloc, setManualAlloc] = useState<Record<string, string>>({});

  // Bills only. Money against a job is not split across invoices — it sits
  // on the job until the invoice is raised at the end, and is swept onto it
  // then. Auto-allocate oldest-first; advanced mode overrides per-bill.
  const billsMode = target?.kind === "bills";

  const autoAllocation = useMemo(() => {
    let left = billsMode ? totalPaise : 0n;
    return bills.map((b) => {
      if (left <= 0n) return { bill: b, take: 0n };
      const take = left >= b.outstanding ? b.outstanding : left;
      left -= take;
      return { bill: b, take };
    });
  }, [bills, totalPaise, billsMode]);

  const effectiveAllocation = useMemo(() => {
    if (!billsMode) return [];
    if (!showAdvanced) return autoAllocation;
    return bills.map((b) => ({ bill: b, take: safePaise(manualAlloc[b.id] ?? "") }));
  }, [billsMode, showAdvanced, autoAllocation, bills, manualAlloc]);

  const allocatedTotal = effectiveAllocation.reduce((s, x) => s + x.take, 0n);
  const kept           = totalPaise > allocatedTotal ? totalPaise - allocatedTotal : 0n;
  const over           = allocatedTotal > totalPaise ? allocatedTotal - totalPaise : 0n;

  const hasTarget = projects.length === 0 && bills.length === 0 ? true : target != null;
  const canSubmit = clientId && hasTarget && totalPaise > 0n && over === 0n && !pending;

  const selectedClient = clients.find((c) => c.id === clientId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    start(async () => {
      const allocations = effectiveAllocation
        .filter((x) => x.take > 0n)
        .map((x) => ({ invoiceId: x.bill.id, amount: x.take.toString() }));

      const res = await createReceipt({
        clientId,
        ...(target?.kind === "project" ? { projectId: target.projectId } : {}),
        branchId:   branches[0]?.id ?? "",
        date:       iso(new Date()),
        mode,
        reference:  reference.trim() || undefined,
        chequeDate: mode === "CHEQUE" ? chequeDate : undefined,
        amount:     totalPaise.toString(),
        allocations,
      });
      if (!res.ok) {
        setServerError(res.error ?? "Could not save the payment. Please try again.");
        return;
      }
      router.push(`/accounts/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[14px] text-text mb-2">Nobody owes you anything right now.</div>
        <p className="text-[12px] text-text-dim">
          Send a quotation and have the client agree it — the job then appears here and you can
          record what they pay you against it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-[560px] mx-auto space-y-5">
      <PaymentSheetClient
        clients={clients}
        selected={selectedClient ?? null}
        onChange={setClientId}
      />

      {clientId && (
        <>
          {/* Step 1 — What is this for? */}
          <PaymentSheetTarget
            projects={projects}
            billCount={bills.length}
            billTotal={billsTotal}
            value={target}
            onChange={(t) => { setTarget(t); setAmount(""); setManualAlloc({}); }}
          />

          {!loadingBills && projects.length === 0 && bills.length === 0 && (
            <div className="rounded-[14px] border border-rule bg-surface px-5 py-4 text-[12px] text-text-dim">
              This client has no open job and no unpaid bill. The payment will be recorded
              against them and can be put towards a job later.
            </div>
          )}

          {/* Step 2 — How much? */}
          <PaymentSheetAmount
            amount={amount}
            onAmountChange={setAmount}
            totalPaise={totalPaise}
            fullOutstanding={fullOutstanding}
            loading={loadingBills}
            projectName={selectedProject?.name ?? null}
            projectDue={selectedProject?.due ?? null}
          />

          {/* Step 3 — How? (modes + cheque date + reference) */}
          <PaymentSheetMode
            mode={mode}
            onModeChange={setMode}
            chequeDate={chequeDate}
            onChequeDateChange={setChequeDate}
            reference={reference}
            onReferenceChange={setReference}
          />

          {/* Step 4 — Preview what this clears. Bills only: money on a job
              clears the job, and the line above already says by how much. */}
          {billsMode && totalPaise > 0n && bills.length > 0 && (
            <PaymentSheetPreview
              rows={effectiveAllocation}
              kept={kept}
              over={over}
              showAdvanced={showAdvanced}
              onToggleAdvanced={() => setShowAdvanced((v) => !v)}
              manualAlloc={manualAlloc}
              onManualAllocChange={(id, v) => setManualAlloc((a) => ({ ...a, [id]: v }))}
            />
          )}

          {serverError && (
            <div className="rounded-[10px] border border-fault/40 bg-fault/5 px-4 py-2.5 text-[12px] text-fault">
              {serverError}
            </div>
          )}

          {/* Save — ≥56px, hero-gold */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-14 rounded-[12px] bg-gold text-ink text-[14.5px] font-semibold hover:bg-gold-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            Record payment
          </button>
        </>
      )}
    </form>
  );
}
