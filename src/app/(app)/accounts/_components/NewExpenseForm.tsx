"use client";

// "New expense" — a trigger that lives in the tab header, and a form that
// does NOT.
//
// The button used to replace ITSELF with the whole form. Its call site sits
// inside the header's `flex items-center gap-2` row, next to the period
// chips, so a five-field card was being laid out in a slot sized for a
// chip: the fields collapsed into a narrow right-hand column and left half
// the row empty. Nothing was wrong with the form — it was the container.
//
// So the two are split. `NewExpenseSection` owns the open state and renders
// the trigger inline where the header wants it, then the form as a
// full-width row of its own beneath. Head + note + amount + date + how it
// was paid, with GST (rate, vendor GSTIN, bill ref) behind a toggle so the
// common case — no GST, or exempt — stays a five-field form.

import { createContext, useContext, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { NewExpenseSheet } from "./_expense-sheet";

// Shared between the trigger and the form so the two can sit in different
// places in the tree without the parent having to be a client component.
const ExpenseFormCtx = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
} | null>(null);

function useExpenseForm() {
  const ctx = useContext(ExpenseFormCtx);
  if (!ctx) throw new Error("NewExpenseButton/Panel must be inside NewExpenseSection");
  return ctx;
}

/** Wraps the part of the tab that contains both the trigger and the form. */
export function NewExpenseSection({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ExpenseFormCtx.Provider value={{ open, setOpen }}>
      {children}
    </ExpenseFormCtx.Provider>
  );
}

/** The trigger. Belongs in the header row, beside the period chips. */
export function NewExpenseButton() {
  const { open, setOpen } = useExpenseForm();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] text-[12.5px] font-semibold transition-colors ${
        open
          ? "border border-rule text-text-dim hover:text-text"
          : "bg-gold text-ink hover:bg-gold-strong"
      }`}
    >
      <Plus
        size={13}
        strokeWidth={2.5}
        className={`transition-transform ${open ? "rotate-45" : ""}`}
      />
      {open ? "Close" : "New expense"}
    </button>
  );
}

/** The form. Belongs on a row of its own, at full width. */
export function NewExpensePanel() {
  const { open, setOpen } = useExpenseForm();
  if (!open) return null;
  return <NewExpenseSheet onClose={() => setOpen(false)} />;
}
