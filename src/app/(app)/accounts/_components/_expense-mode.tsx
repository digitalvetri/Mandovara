"use client";

// "How was it paid?" — the tender picker on the new-expense form.
//
// Added 2026-09-04 (owner instruction). The form recorded what was
// bought, for how much and on what date, but not how the money left —
// so at month end there was no way to reconcile the expense list against
// the cash box, the bank statement and the cheque book. Every other
// money row in this module already carries a mode; the expense was the
// one that did not.
//
// Its own file for the same reason _expense-gst.tsx has one: NewExpenseForm
// sits close to the §10 300-line ceiling.
//
// Six database values, five buttons: NEFT and RTGS are one idea to the
// person filling this in ("it went through the bank"), so they collapse
// under a single "Bank" that stores NEFT — exactly what PaymentSheetMode
// already does for receipts, and worth matching so the two screens
// don't disagree about how many ways there are to pay.

import { Smartphone, Banknote, Landmark, FileText, CreditCard } from "lucide-react";
import type { ExpensePaymentMode } from "@/modules/expenses/schema";

const MODES: ReadonlyArray<{
  key:   ExpensePaymentMode;
  label: string;
  Icon:  React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { key: "CASH",   label: "Cash",   Icon: Banknote   },
  { key: "UPI",    label: "UPI",    Icon: Smartphone },
  { key: "NEFT",   label: "Bank",   Icon: Landmark   },
  { key: "CHEQUE", label: "Cheque", Icon: FileText   },
  { key: "CARD",   label: "Card",   Icon: CreditCard },
];

interface Props {
  mode:     ExpensePaymentMode | null;
  setMode:  (m: ExpensePaymentMode) => void;
  /** Shown under the row when the user tries to save without choosing. */
  error?:   string | undefined;
}

export function ExpenseModePicker({ mode, setMode, error }: Props) {
  return (
    <div className="sm:col-span-12">
      <label className="mb-1.5 block text-[11px] text-text-dim">
        How was it paid? <span className="text-fault">*</span>
      </label>
      {/* Two rows of three on a phone rather than five squeezed across
          320px; one row of five from `sm` up. */}
      <div
        role="radiogroup"
        aria-label="Payment mode"
        className="grid grid-cols-3 gap-2 sm:grid-cols-5"
      >
        {MODES.map(({ key, label, Icon }) => {
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(key)}
              className={[
                "flex h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] border transition-colors",
                active
                  ? "border-gold bg-gold/10 text-text"
                  : "border-rule text-text-dim hover:border-text-dim hover:text-text",
              ].join(" ")}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span className="text-[11.5px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
      {error && <div className="mt-1 text-[10.5px] text-fault">{error}</div>}
    </div>
  );
}
