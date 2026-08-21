"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ChevronDown } from "lucide-react";
import { createCollection } from "@/modules/catalog/actions";

const FAMILIES = [
  { value: "WALLPAPER",         label: "Wallpaper" },
  { value: "CURTAIN_FABRIC",    label: "Curtain Fabric" },
  { value: "SHEER",             label: "Sheer" },
  { value: "BLIND",             label: "Blind" },
  { value: "FLOORING",          label: "Flooring" },
  { value: "CARPET_ROLL",       label: "Carpet Roll" },
  { value: "CARPET_TILE",       label: "Carpet Tile" },
  { value: "UPHOLSTERY_FABRIC", label: "Upholstery Fabric" },
  { value: "INTERIOR_FILM",     label: "Interior Film" },
  { value: "VERTICAL_GARDEN",   label: "Vertical Garden" },
  { value: "MURAL",             label: "Mural" },
  { value: "ACCESSORY",         label: "Accessory" },
] as const;

interface Props { brandId: string }

export function NewCollectionForm({ brandId }: Props) {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [name, setName]     = useState("");
  const [family, setFamily] = useState("WALLPAPER");
  const [error, setError]   = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function close() { setName(""); setFamily("WALLPAPER"); setError(null); setOpen(false); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Collection name is required"); return; }
    setError(null);
    startSave(async () => {
      const res = await createCollection({ brandId, name: name.trim(), family });
      if (!res.ok) { setError(res.error ?? "Failed to create collection"); return; }
      close();
      router.refresh();
    });
  }

  const inputCls = "w-full h-9 rounded-[7px] border border-rule bg-ink/20 px-3 text-[13px] text-text placeholder:text-text-dim/50 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-4 rounded-[7px] text-[12px] font-medium text-text-dim border border-rule hover:text-accent hover:border-accent/50 transition-colors"
      >
        <Plus size={13} strokeWidth={2.5} />
        Add Collection
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-start gap-3 p-4 bg-accent/5 border border-accent/20 rounded-[10px]"
    >
      <div className="flex-1 min-w-0">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Collection name"
          className={inputCls}
        />
        {error && <p className="text-[11px] text-fault mt-1">{error}</p>}
      </div>

      <div className="relative shrink-0">
        <select
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          className="h-9 pl-3 pr-8 rounded-[7px] border border-rule bg-ink/20 text-[13px] text-text appearance-none focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors cursor-pointer"
        >
          {FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="h-9 px-4 rounded-[7px] text-[12px] font-semibold bg-accent text-ink hover:bg-accent/85 disabled:opacity-60 transition-colors shrink-0"
      >
        {saving ? "Adding…" : "Add"}
      </button>
      <button
        type="button"
        onClick={close}
        className="h-9 w-9 flex items-center justify-center rounded-[7px] text-text-dim border border-rule hover:bg-ink/20 transition-colors shrink-0"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </form>
  );
}
