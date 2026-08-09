"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseRequest } from "@/modules/purchase-requests/actions";

const UNITS = ["METRE", "ROLL", "SQFT", "SQM", "PIECE", "SET", "BOX", "RUNNING_FT"] as const;

export function NewRequestButton() {
  const [open, setOpen]       = useState(false);
  const [pending, start]      = useTransition();
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd   = new FormData(e.currentTarget);
    const data = {
      reason:    fd.get("reason") as string,
      projectId: (fd.get("projectId") as string) || undefined,
      neededBy:  (fd.get("neededBy") as string)  || undefined,
      lines: [{
        colourwayId:  (fd.get("colourwayId") as string) || undefined,
        freeTextItem: (fd.get("freeTextItem") as string) || undefined,
        quantity: Number(fd.get("quantity")),
        unit: fd.get("unit") as string,
      }],
    };
    setError(null);
    start(async () => {
      const res = await createPurchaseRequest(data);
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-[32px] px-4 rounded-[8px] bg-accent text-ink text-[12px] font-semibold hover:bg-accent-strong transition-colors"
      >
        + New Request
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] rounded-[14px] bg-surface border border-rule p-6 space-y-4"
          >
            <div className="font-display text-[17px] font-semibold">New Purchase Request</div>

            <Field label="Reason for request">
              <textarea name="reason" required rows={2} className={inputCls + " !h-auto resize-none"} />
            </Field>
            <Field label="Project ID (optional)">
              <input type="text" name="projectId" placeholder="cuid…" className={inputCls} />
            </Field>
            <Field label="Needed by">
              <input type="date" name="neededBy" className={inputCls} />
            </Field>

            <div className="rounded-[8px] bg-surface-2 border border-rule p-3 space-y-2">
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">First line item</div>
              <Field label="Colourway ID (or leave blank)">
                <input type="text" name="colourwayId" placeholder="cuid…" className={inputCls} />
              </Field>
              <Field label="Free text item (if no colourway)">
                <input type="text" name="freeTextItem" placeholder="e.g. Curtain hooks 19mm" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Quantity">
                  <input type="number" name="quantity" step="0.001" min="0.001" required defaultValue="1" className={inputCls} />
                </Field>
                <Field label="Unit">
                  <select name="unit" className={inputCls}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            {error && <div className="text-[11.5px] text-fault">{error}</div>}

            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setOpen(false)}
                className="h-[32px] px-4 rounded-[7px] text-[12px] text-text-dim border border-rule hover:border-text-dim transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={pending}
                className="h-[32px] px-4 rounded-[7px] text-[12px] font-semibold bg-accent text-ink hover:bg-accent-strong disabled:opacity-50 transition-colors">
                Submit
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const inputCls = "w-full h-[34px] px-2.5 rounded-[6px] border border-rule bg-surface-2 text-[12.5px] text-text placeholder:text-text-faint outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1">{label}</label>
      {children}
    </div>
  );
}
