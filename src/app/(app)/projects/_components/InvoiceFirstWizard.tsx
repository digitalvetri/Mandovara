"use client";

// Invoice-first wizard (2026-08-26 owner redesign): the "Create invoice"
// CTA on the project page opens this modal instead of routing to the
// quotation module. The owner picks products + sets quantities + rates,
// hits Create, and lands on the finished invoice. Under the hood a
// quote+order are still created — but the word "quotation" never
// appears on this screen.
//
// This wizard is only shown when the project has NO existing invoiceable
// order. If a quote was already accepted (order exists), the project
// page's CTA takes the user to the normal /invoicing/new picker.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import { ProductPickerDialog } from "@/app/(app)/quotations/_components/ProductPickerDialog";
import type { PickerRow } from "@/modules/quotations/picker-types";
import { formatINR } from "@/kernel/money/format";
import { createInvoiceFromProducts } from "@/modules/invoices/actions-from-products";

interface Line {
  colourwayId: string;
  description: string;
  quantity:    number;
  unit:        string;
  ratePaise:   bigint;
  gstRate:     number;
  hex:         string | null;
}

interface Props {
  projectId: string;
  open:      boolean;
  onClose:   () => void;
}

export function InvoiceFirstWizard({ projectId, open, onClose }: Props) {
  const router = useRouter();
  const [lines, setLines]           = useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [pending, start]            = useTransition();

  // Reset wizard state when closed so a re-open starts clean.
  useEffect(() => {
    if (!open) {
      setLines([]);
      setPickerOpen(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function addLine(row: PickerRow): void {
    setLines((prev) => [
      ...prev,
      {
        colourwayId: row.colourwayId,
        description: row.displayName,
        quantity:    1,
        unit:        row.sellUnit,
        ratePaise:   BigInt(row.ratePaise),
        gstRate:     row.gstRate,
        hex:         row.hex ?? null,
      },
    ]);
    setPickerOpen(false);
  }

  function updateLine(idx: number, patch: Partial<Line>): void {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number): void {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = lines.reduce((s, l) => {
    const q = BigInt(Math.round(l.quantity * 10_000));
    return s + (l.ratePaise * q) / 10_000n;
  }, 0n);

  function submit(): void {
    setError(null);
    if (lines.length === 0) {
      setError("Add at least one product.");
      return;
    }
    start(async () => {
      const res = await createInvoiceFromProducts({
        projectId,
        lines: lines.map((l) => ({
          colourwayId: l.colourwayId,
          description: l.description,
          quantity:    l.quantity,
          unit:        l.unit,
          rate:        (Number(l.ratePaise) / 100).toString(),
          gstRate:     l.gstRate,
        })),
      });
      if (!res.ok || !res.data) {
        // The gate for measurement-required families (curtains, blinds,
        // wallpaper, flooring) fires from createQuotation and comes back
        // as a fieldError. Surface a concrete hint so the owner knows
        // to add a measurement round via the Quick Actions strip first.
        if (res.errorCode === "MEASUREMENT_REQUIRED") {
          setError("One or more products need a measurement round first. Close this and use Add measurement in Quick Actions.");
        } else {
          const firstField = res.fieldErrors ? Object.values(res.fieldErrors)[0] : undefined;
          setError(firstField ?? res.error ?? "Could not create the invoice");
        }
        return;
      }
      router.push(`/invoicing/${res.data.invoiceId}` as Route);
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:p-10"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[720px] rounded-[14px] border border-rule bg-surface shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-rule px-5 py-4">
            <div>
              <div className="font-display text-[16px] font-medium text-text">Create invoice</div>
              <div className="mt-0.5 text-[11px] text-text-dim">
                Pick products for this project. The invoice is created immediately.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-[6px] text-text-dim hover:bg-surface-2 hover:text-text"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-5">
            {lines.length === 0 && (
              <div className="rounded-[10px] border border-dashed border-rule px-4 py-8 text-center text-[12.5px] text-text-dim">
                No products yet. Click <span className="text-text">Add product</span> to start.
              </div>
            )}

            {lines.length > 0 && (
              <ul className="space-y-2">
                {lines.map((l, i) => {
                  const q = BigInt(Math.round(l.quantity * 10_000));
                  const amount = (l.ratePaise * q) / 10_000n;
                  return (
                    <li key={`${l.colourwayId}-${i}`} className="rounded-[10px] border border-rule bg-surface-2/40 p-3">
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className="mt-1 h-4 w-4 shrink-0 rounded-[3px] border border-rule"
                          style={l.hex ? { backgroundColor: l.hex } : undefined}
                        />
                        <input
                          type="text"
                          value={l.description}
                          onChange={(e) => updateLine(i, { description: e.target.value })}
                          className="flex-1 rounded-[6px] border border-rule bg-surface px-2 py-1 text-[12.5px] text-text focus:border-gold focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          aria-label="Remove"
                          className="grid h-7 w-7 place-items-center rounded-[6px] text-text-dim hover:bg-fault/10 hover:text-fault"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_1fr_1fr_1fr] items-center gap-2">
                        <NumberField
                          label="Qty"
                          value={l.quantity}
                          onChange={(v) => updateLine(i, { quantity: v })}
                        />
                        <div className="text-[11px] text-text-dim">
                          <div className="mb-0.5 uppercase tracking-[0.1em]">Unit</div>
                          <div className="rounded-[6px] border border-rule bg-surface px-2 py-1 text-[12px] text-text">{l.unit}</div>
                        </div>
                        <NumberField
                          label="Rate ₹"
                          value={Number(l.ratePaise) / 100}
                          onChange={(v) => updateLine(i, { ratePaise: BigInt(Math.round(v * 100)) })}
                        />
                        <div className="text-[11px] text-text-dim">
                          <div className="mb-0.5 uppercase tracking-[0.1em]">Amount</div>
                          <div className="rounded-[6px] border border-rule bg-surface px-2 py-1 text-right text-[12px] tabular-nums text-text">
                            {formatINR(amount)}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] border border-dashed border-rule bg-surface-2/40 px-3 py-2 text-[12px] text-text-dim hover:border-gold hover:text-text"
            >
              <Plus size={13} strokeWidth={2} />
              Add product
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-rule px-5 py-4">
            <div className="text-[11px] text-text-dim">
              Subtotal (before tax): <span className="text-text tabular-nums">{formatINR(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-[8px] px-3 py-2 text-[12px] text-text-dim hover:text-text disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || lines.length === 0}
                className="inline-flex items-center gap-2 rounded-[8px] bg-gold px-4 py-2 text-[12.5px] font-semibold text-ink hover:bg-gold-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending && <Loader2 size={13} className="animate-spin" />}
                {pending ? "Creating…" : "Create invoice"}
              </button>
            </div>
          </div>

          {error && (
            <div className="border-t border-rule bg-fault/5 px-5 py-3 text-[11.5px] text-fault">
              {error}
            </div>
          )}
        </div>
      </div>

      <ProductPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addLine}
      />
    </>
  );
}

function NumberField({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-[11px] text-text-dim">
      <span className="mb-0.5 block uppercase tracking-[0.1em]">{label}</span>
      <input
        type="number"
        step="any"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-[6px] border border-rule bg-surface px-2 py-1 text-right text-[12px] tabular-nums text-text focus:border-gold focus:outline-none"
      />
    </label>
  );
}
