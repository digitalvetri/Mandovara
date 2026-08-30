"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { wipeTransactionalData } from "@/modules/admin/wipe-transactional";

export function WipeForm() {
  const [phrase, setPhrase] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; wiped?: string[] } | null>(null);

  const ready = phrase === "WIPE ALL DATA";

  function submit() {
    setResult(null);
    start(async () => {
      const r = await wipeTransactionalData({ confirmPhrase: phrase });
      setResult({
        ok:      r.ok,
        message: r.ok ? `Cleared ${r.wiped?.length ?? 0} tables.` : r.error ?? "Wipe failed",
        wiped:   r.wiped,
      });
      if (r.ok) setPhrase("");
    });
  }

  return (
    <div className="max-w-[560px] mx-auto space-y-5">
      <div className="rounded-[14px] border border-fault/40 bg-fault/5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle size={18} className="text-fault shrink-0 mt-0.5" />
          <div>
            <div className="font-display text-[15px] font-semibold text-text mb-1">
              This deletes ALL leads, clients, projects and their downstream data.
            </div>
            <div className="text-[12px] text-text-dim leading-relaxed">
              Wipes measurements, quotations, orders, invoices, receipts, site visits, make jobs,
              purchase orders, employees and their attendance, leave and payroll, vendors, and the
              audit log. Resets document numbering to 0001.
              <br /><br />
              Preserves the product catalog, <strong className="text-text">all stock — balances and
              movements</strong>, and every login account, branch and role. Employee records go;
              the accounts they sign in with do not, so nobody is locked out.
              <strong className="text-fault"> This cannot be undone.</strong>
            </div>
          </div>
        </div>

        <label className="block">
          <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            Type <span className="font-mono text-fault">WIPE ALL DATA</span> to confirm
          </div>
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className="w-full h-[36px] px-3 rounded-[8px] border border-rule bg-surface font-mono text-[13px] outline-none focus:border-fault"
            placeholder="WIPE ALL DATA"
          />
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="mt-4 h-[38px] w-full rounded-[8px] bg-fault text-white text-[13px] font-medium hover:bg-fault-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {pending ? <><Loader2 size={14} className="animate-spin" /> Wiping…</> : "Wipe all data"}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-[10px] p-4 border ${
            result.ok
              ? "border-solid/40 bg-solid/5 text-solid"
              : "border-fault/40 bg-fault/5 text-fault"
          }`}
        >
          <div className="flex items-start gap-2 text-[13px]">
            {result.ok
              ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
            <div>
              <div className="font-medium">{result.message}</div>
              {result.wiped && result.wiped.length > 0 && (
                <div className="mt-2 text-[11px] text-text-dim font-mono">
                  {result.wiped.join(", ")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
