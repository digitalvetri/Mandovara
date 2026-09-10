"use client";

// "Got paid from" — who the money came from.
//
// Split out of PaymentSheet.tsx for the §10 300-line limit. It is one
// question with two shapes: a picker until a client is chosen, then their
// name with a way back.

import type { ClientForReceiptOption } from "@/modules/receipts/queries";

interface Props {
  clients: ClientForReceiptOption[];
  selected: ClientForReceiptOption | null;
  onChange: (clientId: string) => void;
}

export function PaymentSheetClient({ clients, selected, onChange }: Props) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-2">
        Got paid from
      </div>
      {selected ? (
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15.5px] text-text font-medium truncate">{selected.name}</div>
            <div className="text-[11.5px] text-text-dim tabular mt-0.5">{selected.mobile}</div>
          </div>
          {clients.length > 1 && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-[11.5px] text-accent hover:underline whitespace-nowrap"
            >
              Change client
            </button>
          )}
        </div>
      ) : (
        <select
          value=""
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 rounded-[10px] border border-rule bg-transparent px-3 text-[13.5px] text-text outline-none focus:border-gold"
        >
          <option value="">Pick a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.mobile}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
