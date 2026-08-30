"use client";

// Hide a brand from /products without deleting anything underneath.
// Sits between "Wipe collections" and "Delete brand" on the brand
// detail header. Sets Brand.isActive=false; the brand card disappears
// from listBrandsWithPdf(). Every collection / design / colourway /
// PDF / stock row stays untouched.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2 } from "lucide-react";
import { setBrandHidden } from "@/modules/catalog/brand-actions";

interface Props {
  brandId:   string;
  brandName: string;
}

export function HideBrandButton({ brandId, brandName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    start(async () => {
      const res = await setBrandHidden(brandId, true);
      if (!res.ok) { setError(res.error ?? "Hide failed"); return; }
      router.push("/products");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[12px] font-medium text-text-dim/70 border border-rule hover:text-text hover:border-text/40 disabled:opacity-50 transition-colors"
        aria-label={`Hide brand ${brandName} from Product Catalog`}
        title="Hide from Product Catalog — stock and everything underneath stays intact"
      >
        {pending ? <><Loader2 size={13} strokeWidth={1.75} className="animate-spin" /> Hiding…</> : <><EyeOff size={13} strokeWidth={1.75} /> Hide brand</>}
      </button>
      {error && (
        <span className="text-[11px] text-fault ml-2">{error}</span>
      )}
    </>
  );
}
