"use client";

// Order → make cross-link.
//
// If the order already has a make job: renders a link to /make/[id]
// with the job's current status pill. If not: renders a "Create make
// job" button that calls createMakeJobFromOrder and navigates on
// success. §5a's DB-level @@unique([salesOrderId]) is what stops
// two parallel button clicks from stacking jobs — this component
// just optimises the happy path.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { Scissors } from "lucide-react";
import { createMakeJobFromOrder } from "@/modules/make/actions";
import { shortNumber } from "@/lib/short-number";

interface Existing { id: string; number: string; status: string; }
interface Props {
  orderId:    string;
  existing:   Existing | null;
}

export function MakeJobButton({ orderId, existing }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (existing) {
    return (
      <Link
        href={`/make/${existing.id}` as Route}
        className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover flex items-center gap-1.5"
      >
        <Scissors size={13} />
        <span>Make job {shortNumber(existing.number, "MJ-")}</span>
        <span className="text-[10px] text-text-faint uppercase tracking-[0.06em]">
          · {existing.status.toLowerCase()}
        </span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await createMakeJobFromOrder({ orderId });
            if (!res.ok) { setError(res.error ?? "Could not create"); return; }
            router.push(`/make/${res.data!.id}` as Route);
            router.refresh();
          });
        }}
        className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-60 flex items-center gap-1.5"
      >
        <Scissors size={13} /> {pending ? "Creating…" : "Create make job"}
      </button>
      {error && <span className="text-[11.5px] text-bad">{error}</span>}
    </div>
  );
}
