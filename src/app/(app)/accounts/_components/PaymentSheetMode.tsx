"use client";

// "How?" step of PaymentSheet — the 5 payment-mode buttons + the
// cheque-date reveal + the optional reference field. Pulled out to
// keep PaymentSheet.tsx under the 300-line file cap.

import { Smartphone, Banknote, Landmark, FileText, CreditCard } from "lucide-react";
import type { PaymentMode } from "@/modules/receipts/schema";

const MODES: ReadonlyArray<{ key: PaymentMode; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { key: "UPI",    label: "UPI",     Icon: Smartphone },
  { key: "CASH",   label: "Cash",    Icon: Banknote   },
  { key: "NEFT",   label: "Bank",    Icon: Landmark   },   // NEFT + RTGS collapsed under "Bank" for the owner
  { key: "CHEQUE", label: "Cheque",  Icon: FileText   },
  { key: "CARD",   label: "Card",    Icon: CreditCard },
];

interface Props {
  mode:       PaymentMode;
  onModeChange: (m: PaymentMode) => void;
  chequeDate: string;
  onChequeDateChange: (d: string) => void;
  reference:  string;
  onReferenceChange: (r: string) => void;
}

export function PaymentSheetMode({
  mode, onModeChange, chequeDate, onChequeDateChange, reference, onReferenceChange,
}: Props) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-3">How?</div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {MODES.map(({ key, label, Icon }) => {
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onModeChange(key)}
              className={[
                "flex flex-col items-center justify-center gap-1.5 h-16 rounded-[10px] border transition-colors",
                active
                  ? "bg-gold/10 border-gold text-text"
                  : "border-rule text-text-dim hover:text-text hover:border-text-dim",
              ].join(" ")}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="text-[11.5px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {mode === "CHEQUE" && (
        <div className="mt-3">
          <label className="block text-[11px] text-text-dim mb-1">Cheque date</label>
          <input
            type="date"
            value={chequeDate}
            onChange={(e) => onChequeDateChange(e.target.value)}
            className="h-10 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text tabular-nums outline-none focus:border-gold"
          />
          <div className="mt-1.5 text-[10.5px] text-text-dim">
            Cheques start as <span className="text-warn">Not yet cleared</span> — they'll show in
            the Needs-attention list until you mark them cleared.
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="block text-[11px] text-text-dim mb-1">Reference (optional)</label>
        <input
          value={reference}
          onChange={(e) => onReferenceChange(e.target.value)}
          placeholder="UPI txn ID · cheque no · NEFT ref"
          className="w-full h-10 rounded-[8px] border border-rule bg-transparent px-3 text-[12.5px] text-text outline-none focus:border-gold"
        />
      </div>
    </div>
  );
}
