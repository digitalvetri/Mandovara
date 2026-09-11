"use client";

// "What was this payment for?", asked after the fact.
//
// The payment sheet asks it at entry; this asks it of money already sitting
// in Accounts → Received with nothing behind it. Same question, same picker
// (PaymentSheetTarget), so a payment linked here is indistinguishable from
// one recorded against the job in the first place.
//
// Jobs only — no "bills" option. Putting money on a specific invoice means
// deciding how much goes on which bill, which is the payment sheet's job and
// needs amounts; this answers the simpler question the owner actually asked,
// which is which agreed quotation the money belongs to.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkReceiptToProject } from "@/modules/receipts/actions-link";
import { PaymentSheetTarget } from "@/app/(app)/accounts/_components/PaymentSheetTarget";
import {
  toOpenProjects, type OpenProjectWire, type PaymentTarget,
} from "@/app/(app)/accounts/_components/_receipt-primitives";

interface Props {
  receiptId: string;
  projects:  OpenProjectWire[];
}

export function LinkReceiptCard({ receiptId, projects }: Props) {
  const router = useRouter();
  const open = toOpenProjects(projects);
  const [target, setTarget] = useState<PaymentTarget | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [pending, start]    = useTransition();

  if (open.length === 0) {
    return (
      <div className="rounded-[14px] border border-rule bg-surface p-5">
        <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-text-dim">
          What is this for?
        </div>
        <p className="text-[12.5px] text-text-dim">
          This client has no job with money still to come, so there is nothing to put this
          payment against yet. It will become linkable once a quotation is sent for them.
        </p>
      </div>
    );
  }

  function onLink() {
    if (target?.kind !== "project") return;
    const projectId = target.projectId;
    setError(null);
    start(async () => {
      const res = await linkReceiptToProject({ id: receiptId, projectId });
      if (!res.ok) { setError(res.error ?? "Could not link this payment"); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <PaymentSheetTarget
        projects={open}
        billCount={0}
        billTotal={0n}
        value={target}
        onChange={setTarget}
      />

      {error && <div className="text-[12px] text-bad">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onLink}
          disabled={pending || target?.kind !== "project"}
          className="h-[34px] shrink-0 whitespace-nowrap rounded-[8px] bg-accent px-5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Linking…" : "Link this payment"}
        </button>
        <span className="text-[11.5px] text-text-dim">
          It counts against that job&rsquo;s agreed amount straight away, and moves onto the
          tax invoice when one is raised.
        </span>
      </div>
    </div>
  );
}
