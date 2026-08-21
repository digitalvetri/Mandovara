"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createBrand } from "@/modules/catalog/actions";

export function NewBrandModal() {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [name, setName]     = useState("");
  const [country, setCountry] = useState("");
  const [leadDays, setLeadDays] = useState("14");
  const [error, setError]   = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function reset() { setName(""); setCountry(""); setLeadDays("14"); setError(null); }
  function close() { reset(); setOpen(false); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Brand name is required"); return; }
    setError(null);
    startSave(async () => {
      const res = await createBrand({
        name: name.trim(),
        country: country.trim() || undefined,
        leadTimeDays: parseInt(leadDays) || 14,
      });
      if (!res.ok) { setError(res.error ?? "Failed to create brand"); return; }
      close();
      router.push(`/products/brand/${res.data!.id}`);
    });
  }

  const inputCls = "w-full h-9 rounded-[7px] border border-rule bg-ink/20 px-3 text-[13px] text-text placeholder:text-text-dim/50 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-4 rounded-[7px] text-[12px] font-semibold bg-accent text-ink hover:bg-accent/85 transition-colors"
      >
        <Plus size={13} strokeWidth={2.5} />
        Add Brand
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Add brand">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />
          <div className="relative w-full max-w-md rounded-[16px] bg-surface border border-rule shadow-xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
              <h2 className="text-[15px] font-semibold text-text">Add Brand</h2>
              <button type="button" onClick={close} className="h-7 w-7 flex items-center justify-center rounded-[6px] text-text-dim hover:text-text hover:bg-ink/30 transition-colors">
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-text-dim font-semibold mb-1.5">Brand Name *</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Grandeco"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-text-dim font-semibold mb-1.5">Country / Origin</label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Belgium"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-text-dim font-semibold mb-1.5">Lead Time (days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={leadDays}
                  onChange={(e) => setLeadDays(e.target.value)}
                  className={inputCls}
                />
              </div>

              {error && <p className="text-[12px] text-fault">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={close} className="h-8 px-4 rounded-[7px] text-[12px] text-text-dim border border-rule hover:bg-ink/20 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 px-5 rounded-[7px] text-[12px] font-semibold bg-accent text-ink hover:bg-accent/85 disabled:opacity-60 transition-colors"
                >
                  {saving ? "Creating…" : "Create Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
