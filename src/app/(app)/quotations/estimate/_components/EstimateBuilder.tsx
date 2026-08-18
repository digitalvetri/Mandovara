"use client";

// Free-text estimate builder: no catalog picker, no project, no measurement.
// Everything the older builders demanded before you could see a total.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FileText } from "lucide-react";
import { createEstimate } from "@/modules/quotations/estimate-actions";
import { SELL_UNITS } from "@/modules/quotations/schema";

interface Line {
  description: string;
  quantity:    string;
  unit:        string;
  rate:        string;
  gstRate:     string;
  discountPct: string;
}

const BLANK: Line = {
  description: "", quantity: "1", unit: "PIECE", rate: "", gstRate: "18", discountPct: "0",
};

// Common GST slabs for this trade (§4). 18% covers most furnishing work.
const GST_OPTIONS = ["0", "5", "12", "18", "28"];

function toPaise(rupees: string): bigint {
  const n = Number(rupees.replace(/,/g, ""));
  return Number.isFinite(n) ? BigInt(Math.round(n * 100)) : 0n;
}
function inr(paise: bigint): string {
  const neg = paise < 0n;
  const a = neg ? -paise : paise;
  const r = (a / 100n).toString();
  const p = (a % 100n).toString().padStart(2, "0");
  const last3 = r.slice(-3);
  const rest  = r.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `${neg ? "(" : ""}₹${grouped}${p === "00" ? "" : "." + p}${neg ? ")" : ""}`;
}

export function EstimateBuilder({ branches }: { branches: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [name,   setName]   = useState("");
  const [mobile, setMobile] = useState("");
  const [email,  setEmail]  = useState("");
  const [requirement, setRequirement] = useState("");
  const [validDays, setValidDays] = useState("15");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }]);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let taxable = 0n, tax = 0n;
    for (const l of lines) {
      const gross = (toPaise(l.rate) * BigInt(Math.round(Number(l.quantity || "0") * 10_000))) / 10_000n;
      const disc  = (gross * BigInt(Math.round(Number(l.discountPct || "0") * 100))) / 10_000n;
      const t     = gross - disc;
      taxable += t;
      tax     += (t * BigInt(Math.round(Number(l.gstRate || "0") * 100))) / 10_000n;
    }
    return { taxable, tax, total: taxable + tax };
  }, [lines]);

  const ready =
    branchId &&
    name.trim().length >= 2 && mobile.trim().length >= 6 &&
    lines.some((l) => l.description.trim() && Number(l.quantity) > 0 && toPaise(l.rate) > 0n);

  function set(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await createEstimate({
        branchId,
        newLead: {
          name: name.trim(), mobile: mobile.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(requirement.trim() ? { requirement: requirement.trim() } : {}),
        },
        validForDays: Number(validDays) || 15,
        ...(terms.trim() ? { termsText: terms.trim() } : {}),
        lines: lines
          .filter((l) => l.description.trim() && toPaise(l.rate) > 0n)
          .map((l) => ({
            description: l.description.trim(),
            quantity:    Number(l.quantity),
            unit:        l.unit,
            rate:        l.rate,
            gstRate:     Number(l.gstRate),
            discountPct: Number(l.discountPct) || 0,
          })),
      });
      if (res.ok && res.data) router.push(`/quotations/${res.data.quotationId}`);
      else setError(res.error ?? "Could not create the estimate.");
    });
  }

  return (
    <div className="pb-12">
      {/* ── Who it is for ── */}
      <section className="rounded-[12px] border border-rule bg-surface p-4 mb-4">
        <h2 className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Enquiry from</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Name" value={name} onChange={setName} placeholder="Anand Kumar" />
          <Field label="Mobile" value={mobile} onChange={setMobile} placeholder="+91 98xxx xxxxx" />
          <Field label="Email (optional)" value={email} onChange={setEmail} placeholder="anand@example.com" />
          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Branch</div>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full h-[36px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[12.5px] text-text"
            >
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <Field label="What they asked for (optional)" value={requirement} onChange={setRequirement}
                 placeholder="Curtains for 3 bedrooms and a living-room feature wall" />
        </div>
        <p className="mt-2 text-[11px] text-text-faint">
          This creates a lead so the enquiry is not lost, and the estimate is filed against it.
        </p>
      </section>

      {/* ── Lines ── */}
      <section className="rounded-[12px] border border-rule bg-surface p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">What you are quoting</h2>
          <button type="button" onClick={() => setLines((l) => [...l, { ...BLANK }])}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] border border-rule text-[12px] text-text-dim hover:text-text hover:bg-surface-2">
            <Plus size={13} strokeWidth={1.9} /> Add line
          </button>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-2 items-end">
              <Field label={i === 0 ? "Description" : ""} value={l.description}
                     onChange={(v) => set(i, { description: v })}
                     placeholder="Curtains — 3 bedrooms, stitched and installed" />
              <Field label={i === 0 ? "Qty" : ""} value={l.quantity} onChange={(v) => set(i, { quantity: v })} width="w-[72px]" />
              <label className="block">
                {i === 0 && <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Unit</div>}
                <select value={l.unit} onChange={(e) => set(i, { unit: e.target.value })}
                        className="h-[36px] w-[104px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[12.5px] text-text">
                  {SELL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <Field label={i === 0 ? "Rate ₹" : ""} value={l.rate} onChange={(v) => set(i, { rate: v })} width="w-[104px]" placeholder="45000" />
              <label className="block">
                {i === 0 && <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">GST %</div>}
                <select value={l.gstRate} onChange={(e) => set(i, { gstRate: e.target.value })}
                        className="h-[36px] w-[74px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[12.5px] text-text tabular">
                  {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <Field label={i === 0 ? "Disc %" : ""} value={l.discountPct} onChange={(v) => set(i, { discountPct: v })} width="w-[74px]" />
              <button type="button" aria-label="Remove line"
                      onClick={() => setLines((ls) => (ls.length === 1 ? [{ ...BLANK }] : ls.filter((_, j) => j !== i)))}
                      className="h-[36px] w-[36px] grid place-items-center rounded-[6px] border border-rule text-text-faint hover:text-fault hover:border-fault/40">
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Terms + totals ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-[12px] border border-rule bg-surface p-4">
          <Field label="Terms (optional)" value={terms} onChange={setTerms}
                 placeholder="50% advance with order. Balance before installation." />
          <div className="mt-3 w-[160px]">
            <Field label="Valid for (days)" value={validDays} onChange={setValidDays} />
          </div>
        </div>

        <div className="rounded-[12px] border border-rule bg-surface p-4">
          <Row k="Taxable" v={inr(totals.taxable)} />
          <Row k="GST"     v={inr(totals.tax)} />
          <div className="mt-2 pt-2 border-t border-rule flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-[0.14em] text-text-dim">Total</span>
            <span className="font-data text-[20px] tabular text-text">{inr(totals.total)}</span>
          </div>

          {error && <p className="mt-3 text-[12px] text-fault">{error}</p>}

          <button type="button" onClick={submit} disabled={!ready || pending}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 h-10 rounded-[8px] bg-gold/15 text-gold border border-gold/30 text-[13px] font-medium hover:bg-gold/25 disabled:opacity-50">
            <FileText size={14} strokeWidth={1.8} />
            {pending ? "Creating…" : "Create estimate"}
          </button>
          <p className="mt-2 text-[10.5px] text-text-faint leading-relaxed">
            Prints as an <strong>Estimate</strong> with a note that quantities are
            confirmed after site measurement.
          </p>
        </div>
      </section>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, width = "w-full",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; width?: string }) {
  return (
    <label className="block min-w-0">
      {label && <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${width} h-[36px] px-3 bg-surface-2 border border-rule rounded-[6px] text-[12.5px] text-text placeholder:text-text-faint outline-none focus:border-gold/50`}
      />
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[11.5px] text-text-muted">{k}</span>
      <span className="font-data text-[12.5px] tabular text-text-dim">{v}</span>
    </div>
  );
}
