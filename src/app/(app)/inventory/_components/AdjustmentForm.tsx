"use client";

// Single-line stock adjustment. Direction toggle + product/warehouse pickers
// + qty/rate/reason/note. Server enforces the never-negative guard and
// override permission.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { postAdjustment } from "@/modules/inventory/actions";
import { ADJUSTMENT_REASONS, type AdjustmentReason } from "@/modules/inventory/schema";
import type { ProductPickerRow } from "@/modules/inventory/queries";

interface Props {
  products: ProductPickerRow[];
  warehouses: { id: string; name: string }[];
}

export function AdjustmentForm({ products, warehouses }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [productId, setProductId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id ?? "");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [reason, setReason] = useState<AdjustmentReason>("COUNT_CORRECTION");
  const [note, setNote] = useState<string>("");
  const [adjustedAt, setAdjustedAt] = useState<string>(iso(new Date()));
  const [overrideNegative, setOverrideNegative] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await postAdjustment({
        productId, warehouseId, direction,
        quantity: Number(quantity),
        rate,
        reason, note,
        adjustedAt, overrideNegative,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not post adjustment");
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      router.push(`/inventory/${productId}` as Route);
      router.refresh();
    });
  }

  if (products.length === 0 || warehouses.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[14px] text-text mb-2">
          {products.length === 0 ? "No products in the catalog." : "No warehouses configured."}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <Field label="Product" required error={fieldErrors["productId"]}>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={fieldCls}>
            <option value="">— pick a product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Warehouse" required error={fieldErrors["warehouseId"]}>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={fieldCls}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Adjusted on" required>
          <input type="date" value={adjustedAt} onChange={(e) => setAdjustedAt(e.target.value)}
                 className={`${fieldCls} tabular`} />
        </Field>

        <Field label="Direction" required>
          <div className="flex items-center gap-1 border border-rule rounded-[6px] bg-white/60 h-[34px] p-0.5">
            {(["IN", "OUT"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDirection(d)}
                      className={[
                        "flex-1 rounded-[4px] text-[12px] transition-colors",
                        direction === d
                          ? (d === "IN" ? "bg-good text-white" : "bg-bad text-white")
                          : "text-text-dim hover:text-text",
                      ].join(" ")}>
                {d === "IN" ? "Stock IN" : "Stock OUT"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Quantity" required error={fieldErrors["quantity"]}>
          <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                 className={`${fieldCls} tabular`} placeholder="e.g. 50" />
        </Field>
        <Field label="Rate per unit" required error={fieldErrors["rate"]} hint="Valuation rate in ₹">
          <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)}
                 className={`${fieldCls} tabular`} placeholder="e.g. 12500" />
        </Field>

        <Field label="Reason" required error={fieldErrors["reason"]}>
          <select value={reason} onChange={(e) => setReason(e.target.value as AdjustmentReason)}
                  className={fieldCls}>
            {ADJUSTMENT_REASONS.map((r) => <option key={r} value={r}>{humaniseReason(r)}</option>)}
          </select>
        </Field>
        <Field label="Note" span={2} error={fieldErrors["note"]}>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls}
                 placeholder="Optional. Names what you found and where." />
        </Field>

        <label className="col-span-3 flex items-center gap-2 mt-2 text-[12px] text-text">
          <input type="checkbox" checked={overrideNegative} onChange={(e) => setOverrideNegative(e.target.checked)}
                 className="accent-bad" />
          Override negative-stock guard (audited)
        </label>
      </div>

      {error && <div className="mt-4 text-[12px] text-bad">{error}</div>}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()}
                className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={pending || !productId || !quantity || !rate}
                className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors">
          {pending ? "Posting…" : "Post adjustment"}
        </button>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function humaniseReason(r: string): string {
  return r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, " ");
}
function Field({
  label, required, error, hint, span = 1, children,
}: { label: string; required?: boolean; error?: string; hint?: string; span?: 1 | 2 | 3;
     children: React.ReactNode }) {
  const spanCls = span === 3 ? "col-span-3" : span === 2 ? "lg:col-span-2" : undefined;
  return (
    <div className={spanCls}>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
      <div className="mt-1 min-h-[14px] text-[11px]">
        {error ? <span className="text-bad">{error}</span>
              : hint ? <span className="text-text-faint">{hint}</span> : null}
      </div>
    </div>
  );
}
