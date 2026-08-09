"use client";

// Raise a snag against this visit — simple location + description
// pair. Photos come with 5c-PWA (installers take them on the phone).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { raiseSnagOnVisit } from "@/modules/install/actions";

export function RaiseSnagForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [loc, setLoc]   = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (loc.trim().length === 0 || desc.trim().length === 0) {
      setError("Location and description required.");
      return;
    }
    startT(async () => {
      const res = await raiseSnagOnVisit({
        visitId, location: loc.trim(), description: desc.trim(),
      });
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      setLoc(""); setDesc("");
      router.refresh();
    });
  }

  return (
    <div className="text-[11.5px] space-y-2">
      <div className="text-[10px] uppercase tracking-[0.10em] text-text-dim">Raise snag</div>
      <input
        type="text" value={loc} onChange={(e) => setLoc(e.target.value)}
        placeholder="Room / location"
        className="w-full h-[28px] px-2 text-[11.5px] bg-white/60 border border-rule rounded-[5px] outline-none focus:border-accent"
      />
      <textarea
        value={desc} onChange={(e) => setDesc(e.target.value)}
        placeholder="What went wrong?"
        rows={2}
        className="w-full px-2 py-1.5 text-[11.5px] bg-white/60 border border-rule rounded-[5px] outline-none focus:border-accent resize-none"
      />
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="h-[28px] px-3 rounded-[5px] text-[11.5px] font-medium bg-bad/15 text-bad hover:bg-bad/25 disabled:opacity-60"
      >
        {pending ? "…" : "Raise snag"}
      </button>
      {error && <div className="text-[10.5px] text-bad">{error}</div>}
    </div>
  );
}
