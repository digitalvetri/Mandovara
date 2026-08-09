"use client";

// Quote Builder — pick a product from the top dropdown, click "Add item"
// to drop a row into the table. Adjust quantity with the − / + stepper.
// Right sidebar shows a live Subtotal / GST / Total plus the primary
// "Send Quote to Client" and "Download PDF" actions.
//
// Numbers on screen are client-side previews of what the server will
// re-compute on save through @/kernel/tax. No demo data — the table
// starts empty; the owner picks their real client and their real SKUs.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Minus, Plus, X, Ruler } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import {
  createQuotation, loadMeasurementsForClient,
} from "@/modules/quotations/actions";
import type {
  ClientPickerRow, ProductPickerRow, MeasurementPickerRow,
} from "@/modules/quotations/queries";
import type { BranchOption } from "@/modules/branches/queries";

interface LineRow {
  productId: string;
  quantity: number;
  // §0.10: only meaningful when the picked product.requiresMeasurement is
  // true. Server validates independently, but tracking here lets us
  // disable "Send" until every M2M line is linked.
  measurementItemId?: string;
}

interface Props {
  clients: ClientPickerRow[];
  products: ProductPickerRow[];
  branches: BranchOption[];
}

export function QuotationBuilder({ clients, products, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const today = new Date();
  const nextMonth = new Date(); nextMonth.setDate(today.getDate() + 30);

  const [clientId, setClientId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? "");
  const [date] = useState<string>(iso(today));
  const [validUntil] = useState<string>(iso(nextMonth));
  const [pickerProductId, setPickerProductId] = useState<string>("");
  const [lines, setLines] = useState<LineRow[]>([]);
  // Measurement items belonging to the selected client's projects. Loaded
  // by a server action whenever `clientId` changes so we never leak items
  // across clients and never blow the initial page payload with them.
  const [measurements, setMeasurements] = useState<MeasurementPickerRow[]>([]);
  const [measurementsLoading, setMeasurementsLoading] = useState(false);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const measurementMap = useMemo(
    () => new Map(measurements.map((m) => [m.id, m])),
    [measurements],
  );
  const client = clients.find((c) => c.id === clientId);

  useEffect(() => {
    if (!clientId) { setMeasurements([]); return; }
    let cancelled = false;
    setMeasurementsLoading(true);
    loadMeasurementsForClient(clientId)
      .then((res) => {
        if (cancelled) return;
        setMeasurements(res.ok && res.data ? res.data : []);
      })
      .finally(() => { if (!cancelled) setMeasurementsLoading(false); });
    // Client switch → drop any stale measurement selections. Product
    // selections stay; the user is often re-quoting the same items for
    // a different site so keeping quantities saves retyping.
    setLines((ls) => ls.map((l) => ({ ...l, measurementItemId: undefined })));
    return () => { cancelled = true; };
  }, [clientId]);
  // Supplier state vs client state drives intra/inter-state GST split. For
  // the preview we treat matching state as intra-state; server recomputes.
  const supplierState = "33";
  const clientState = client?.stateCode ?? supplierState;
  const isIntraState = supplierState === clientState;

  const totals = useMemo(() => {
    let subtotal = 0n, gst = 0n;
    for (const l of lines) {
      const p = productMap.get(l.productId);
      if (!p) continue;
      const rate = p.mrp ?? 0n;
      const qty = l.quantity || 0;
      const gross = (rate * BigInt(Math.round(qty * 10_000))) / 10_000n;
      subtotal += gross;
      gst += (gross * BigInt(Math.round(p.gstRate * 100))) / 10_000n;
    }
    return { subtotal, gst, total: subtotal + gst };
  }, [lines, productMap]);

  function addItem() {
    if (!pickerProductId) return;
    const idx = lines.findIndex((l) => l.productId === pickerProductId);
    if (idx >= 0) {
      setLines((ls) => ls.map((l, i) => i === idx ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      setLines((ls) => [...ls, { productId: pickerProductId, quantity: 1 }]);
    }
    setPickerProductId("");
  }
  function bump(i: number, delta: number) {
    setLines((ls) => ls.map((l, idx) =>
      idx === i ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l,
    ));
  }
  function setQty(i: number, v: string) {
    const n = Math.max(1, Math.floor(Number(v) || 1));
    setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, quantity: n } : l));
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }
  function setLineMeasurement(i: number, v: string) {
    setLines((ls) => ls.map((l, idx) =>
      idx === i ? { ...l, measurementItemId: v || undefined } : l,
    ));
  }

  // §0.10 client-side mirror of the server gate: any line whose product
  // requiresMeasurement must carry a measurementItemId. This drives both
  // the "Send" button's disabled state and the inline warning row.
  const missingMeasurement = useMemo(
    () => lines.some((l) => {
      const p = productMap.get(l.productId);
      return !!p?.requiresMeasurement && !l.measurementItemId;
    }),
    [lines, productMap],
  );

  function onSend() {
    setServerError(null);
    if (!clientId) { setServerError("Pick a client first."); return; }
    if (lines.length === 0) { setServerError("Add at least one item."); return; }
    startTransition(async () => {
      const payload = {
        clientId, branchId, date, validUntil,
        lines: lines.map((l) => {
          const p = productMap.get(l.productId)!;
          return {
            productId:         l.productId,
            description:       p.name,
            quantity:          l.quantity,
            rate:              String(Number(p.mrp ?? 0n) / 100),
            discountPct:       0,
            measurementItemId: l.measurementItemId,
          };
        }),
      };
      const res = await createQuotation(payload);
      if (!res.ok) { setServerError(res.error ?? "Could not create quote"); return; }
      router.push(`/quotations/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  if (clients.length === 0 || products.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[14px] text-text mb-2">
          {clients.length === 0 && products.length === 0
            ? "Add at least one client and one product first."
            : clients.length === 0 ? "Add at least one client first." : "Add at least one product first."}
        </div>
        <p className="text-[12px] text-text-dim">
          A quote needs a client to send to and at least one SKU in the catalog.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 pb-10">
      {/* ── Main card ─────────────────────────────────────────── */}
      <div className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6">
        {/* Quotation header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pb-5">
          <div>
            <div className="font-display text-[24px] sm:text-[28px] font-semibold text-text leading-tight">
              Quotation
            </div>
            <div className="mt-1 text-[11.5px] text-text-dim tabular">
              Draft · {formatDate(new Date(date))}
            </div>
          </div>
          <div className="sm:text-right min-w-0">
            {client ? (
              <>
                <div className="font-display text-[18px] sm:text-[20px] font-semibold text-text leading-tight truncate">
                  {client.name}
                </div>
                <div className="mt-1 text-[11.5px] text-text-dim">
                  State {client.stateCode} · {client.mobile}
                </div>
              </>
            ) : (
              <div className="text-[12px] text-text-faint italic">
                Pick a client below to see their details here
              </div>
            )}
          </div>
        </div>

        {/* Client + branch pickers (compact) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4 border-b border-rule">
          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Client</div>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={fieldCls}>
              <option value="">— pick a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.mobile}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">From branch</div>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fieldCls}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        </div>

        {/* Item picker + Add */}
        <div className="pt-4 pb-4 flex flex-col sm:flex-row gap-2">
          <select
            value={pickerProductId}
            onChange={(e) => setPickerProductId(e.target.value)}
            className={`${fieldCls} h-[42px] flex-1`}
          >
            <option value="">— pick an item to add —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.mrp ? formatINR(p.mrp) : "no price"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addItem}
            disabled={!pickerProductId}
            className="h-[42px] px-5 rounded-[8px] bg-sidebar text-sidebar-text text-[12.5px] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
          >
            Add item
          </button>
        </div>

        {/* Line table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Item</Th>
                <Th align="center" width={140}>Qty</Th>
                <Th align="right"  width={110}>Rate</Th>
                <Th align="right"  width={110}>Amount</Th>
                <Th width={40}></Th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[12px] text-text-faint">
                    Nothing added yet. Pick a product above and click <b>Add item</b>.
                  </td>
                </tr>
              )}
              {lines.map((l, i) => {
                const p = productMap.get(l.productId);
                if (!p) return null;
                const rate = p.mrp ?? 0n;
                const amount = (rate * BigInt(Math.round(l.quantity * 10_000))) / 10_000n;
                const linkedM = l.measurementItemId ? measurementMap.get(l.measurementItemId) : undefined;
                const needsMeasurement = p.requiresMeasurement && !l.measurementItemId;
                return (
                  <tr key={l.productId} className={`border-b border-rule/60 last:border-0 align-middle ${needsMeasurement ? "bg-bad/[0.04]" : ""}`}>
                    <Td>
                      <div className="text-text">{p.name}</div>
                      <div className="text-[10.5px] text-text-faint">per {p.uom.toLowerCase()}</div>
                      {p.requiresMeasurement && (
                        <div className="mt-2 flex items-center gap-2">
                          <Ruler size={12} className={needsMeasurement ? "text-bad" : "text-accent"} />
                          <select
                            value={l.measurementItemId ?? ""}
                            onChange={(e) => setLineMeasurement(i, e.target.value)}
                            className={`min-w-0 flex-1 h-[30px] px-2 bg-white/60 border rounded-[6px] text-[11.5px] outline-none focus:border-accent transition-colors ${needsMeasurement ? "border-bad" : "border-rule"}`}
                          >
                            <option value="">
                              {measurementsLoading
                                ? "— loading site measurements —"
                                : measurements.length === 0
                                  ? "— no measurements for this client yet —"
                                  : "— pick a site measurement (required) —"}
                            </option>
                            {measurements.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.projectNumber} · {m.roomLabel} · {m.label} · {m.family.toLowerCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {p.requiresMeasurement && linkedM && (
                        <div className="mt-1 text-[10.5px] text-text-faint tabular">
                          {linkedM.engineVersion} · computed {formatDate(linkedM.computedAt)}
                        </div>
                      )}
                      {needsMeasurement && (
                        <div className="mt-1 text-[10.5px] text-bad">
                          {p.name} is made-to-measure — link a site measurement before sending.
                        </div>
                      )}
                    </Td>
                    <Td align="center">
                      <div className="inline-flex items-center gap-1">
                        <StepButton onClick={() => bump(i, -1)} label="Decrease"><Minus size={12} /></StepButton>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={l.quantity}
                          onChange={(e) => setQty(i, e.target.value)}
                          className="w-[46px] h-[28px] bg-white/60 border border-rule rounded-[6px] text-center text-[12.5px] tabular outline-none focus:border-accent"
                        />
                        <StepButton onClick={() => bump(i, 1)} label="Increase"><Plus size={12} /></StepButton>
                      </div>
                    </Td>
                    <Td align="right"><span className="tabular text-text-dim">{formatINR(rate)}</span></Td>
                    <Td align="right"><span className="tabular text-text font-medium">{formatINR(amount)}</span></Td>
                    <Td align="right">
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        aria-label="Remove"
                        className="h-[24px] w-[24px] grid place-items-center rounded-[4px] text-text-faint hover:text-bad hover:bg-bad/10 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Summary sidebar ────────────────────────────────────── */}
      <aside className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6 h-fit">
        <div className="font-display text-[20px] font-semibold text-text mb-4">Summary</div>

        <dl className="space-y-3 text-[12.5px]">
          <Row k="Subtotal" v={formatINR(totals.subtotal)} />
          <Row k={`GST${isIntraState ? "" : " (IGST)"}`} v={formatINR(totals.gst)} />
          <div className="pt-3 mt-2 border-t border-rule flex items-baseline justify-between">
            <dt className="text-text uppercase text-[10.5px] tracking-[0.14em]">Total</dt>
            <dd className="font-display text-[24px] sm:text-[28px] font-semibold text-accent tabular-nums leading-none">
              {formatINR(totals.total)}
            </dd>
          </div>
        </dl>

        {serverError && (
          <div className="mt-3 text-[11.5px] text-bad">{serverError}</div>
        )}
        {missingMeasurement && !serverError && (
          <div className="mt-3 text-[11.5px] text-bad">
            One or more made-to-measure lines are missing a site measurement (§0.10).
          </div>
        )}

        <button
          type="button"
          onClick={onSend}
          disabled={pending || missingMeasurement}
          className="mt-5 w-full h-[42px] rounded-[10px] bg-accent text-white text-[13px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : "Send Quote to Client"}
        </button>
        <button
          type="button"
          disabled
          className="mt-2 w-full h-[42px] rounded-[10px] bg-transparent border border-rule text-text-dim text-[13px] font-medium hover:bg-surface-hover disabled:opacity-70"
          title="PDF template ships with Session 16"
        >
          Download PDF
        </button>

        <p className="mt-3 text-[10.5px] text-text-faint">
          Numbers here are a live preview. The server re-computes GST per line
          on save so anything you post is audit-safe.
        </p>
      </aside>
    </div>
  );
}

// ── primitives ──────────────────────────────────────────────────

const fieldCls =
  "w-full h-[38px] px-3 bg-white/60 border border-rule rounded-[8px] text-[12.5px] outline-none focus:border-accent transition-colors";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }

function StepButton({ onClick, label, children }: {
  onClick: () => void; label: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-[28px] w-[28px] grid place-items-center rounded-[6px] border border-rule text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
    >
      {children}
    </button>
  );
}
function Th({ children, align = "left", width }: { children?: React.ReactNode; align?: "left" | "center" | "right"; width?: number }) {
  const cls = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return <th style={width ? { width } : undefined} className={`px-3 h-[36px] font-medium ${cls}`}>{children}</th>;
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "center" | "right" }) {
  const cls = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return <td className={`px-3 py-3 ${cls}`}>{children}</td>;
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[12px]">{k}</dt>
      <dd className="text-text text-right tabular font-medium">{v}</dd>
    </div>
  );
}
