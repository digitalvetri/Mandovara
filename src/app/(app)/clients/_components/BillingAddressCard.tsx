"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { updateBillingAddress } from "@/modules/clients/actions";

interface BillingAddr {
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

const lbl = "text-[10px] uppercase tracking-[0.14em] text-text-dim mb-0.5";
const inp = "w-full h-[32px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[13px] text-text outline-none focus:border-accent transition-colors";

export function BillingAddressCard({ clientId, initial }: { clientId: string; initial: BillingAddr | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const addr = initial ?? {};
  const [draft, setDraft] = useState({
    line1:   addr.line1   ?? "",
    city:    addr.city    ?? "",
    state:   addr.state   ?? "",
    pincode: addr.pincode ?? "",
    country: addr.country ?? "India",
  });

  const set = (k: keyof typeof draft) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => ({ ...d, [k]: e.target.value }));

  function startEdit() { setDraft({ line1: addr.line1 ?? "", city: addr.city ?? "", state: addr.state ?? "", pincode: addr.pincode ?? "", country: addr.country ?? "India" }); setEditing(true); }
  function cancel() { setEditing(false); setError(null); }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateBillingAddress({ id: clientId, ...draft });
      if (!res.ok) { setError(res.error ?? "Save failed"); return; }
      setEditing(false);
      router.refresh();
    });
  }

  const hasAddress = !!(addr.line1 || addr.city || addr.pincode);

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">Billing Address</div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={cancel} disabled={pending}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-[6px] text-[11.5px] text-text-dim border border-rule hover:bg-surface-hover transition-colors disabled:opacity-60">
              <X size={11} strokeWidth={2} /> Cancel
            </button>
            <button type="button" onClick={save} disabled={pending}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-[6px] text-[11.5px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-60">
              <Check size={11} strokeWidth={2.5} /> {pending ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={startEdit}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-[6px] text-[11.5px] text-text-dim border border-rule hover:text-text hover:bg-surface-hover transition-colors">
            <Pencil size={11} strokeWidth={1.75} /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <div className={lbl}>Address Line</div>
            <input value={draft.line1} onChange={set("line1")} className={inp} placeholder="Street, Building, Floor" />
          </div>
          <div>
            <div className={lbl}>City</div>
            <input value={draft.city} onChange={set("city")} className={inp} placeholder="Coimbatore" />
          </div>
          <div>
            <div className={lbl}>PIN Code</div>
            <input value={draft.pincode} onChange={set("pincode")} className={inp} placeholder="641002" inputMode="numeric" />
          </div>
          <div>
            <div className={lbl}>State</div>
            <input value={draft.state} onChange={set("state")} className={inp} placeholder="Tamil Nadu" />
          </div>
          <div>
            <div className={lbl}>Country</div>
            <input value={draft.country} onChange={set("country")} className={inp} placeholder="India" />
          </div>
          {error && (
            <div className="col-span-2 text-[12px] text-fault rounded-[6px] bg-fault/10 border border-fault/30 px-2 py-1.5">
              {error}
            </div>
          )}
        </div>
      ) : hasAddress ? (
        <div className="text-[12.5px] text-text">
          {addr.line1 && <div>{addr.line1}</div>}
          <div className="text-text-dim mt-0.5">
            {[addr.city, addr.pincode].filter(Boolean).join(" — ")}
            {addr.state ? ` · ${addr.state}` : ""}
            {addr.country && addr.country !== "India" ? ` · ${addr.country}` : ""}
          </div>
        </div>
      ) : (
        <div className="text-[12px] text-text-faint">
          No billing address on file.{" "}
          <button type="button" onClick={startEdit} className="text-accent hover:underline">Add one</button>
        </div>
      )}
    </div>
  );
}
