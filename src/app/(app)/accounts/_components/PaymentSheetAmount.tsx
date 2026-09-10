"use client";

// "How much?" — the amount, the Full/Part shortcuts, and one plain line
// saying what the payment leaves on the job.
//
// Split out of PaymentSheet.tsx for the §10 300-line limit.
//
// "Full" now means the balance of whatever the payment is FOR — the job's
// remaining balance, or the client's open bills — rather than always the
// bills. On a studio that bills at the end of a job, "full" against bills
// was ₹0 for most clients, so the shortcut filled in nothing.

import { IndianRupee, Loader2 } from "lucide-react";
import { formatINR } from "@/kernel/money/format";

interface Props {
  amount:          string;
  onAmountChange:  (v: string) => void;
  totalPaise:      bigint;
  /** The chosen target's balance — what "Full" fills in. */
  fullOutstanding: bigint;
  loading:         boolean;
  projectName:     string | null;
  projectDue:      bigint | null;
}

export function PaymentSheetAmount({
  amount, onAmountChange, totalPaise, fullOutstanding, loading, projectName, projectDue,
}: Props) {
  return (
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-2">
              How much?
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim">
                <IndianRupee size={17} strokeWidth={2} />
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0"
                className="w-full h-14 rounded-[10px] border border-rule bg-transparent pl-10 pr-3 text-[22px] font-display tabular-nums text-text outline-none focus:border-gold"
              />
            </div>
            {fullOutstanding > 0n && (
              <div className="flex gap-2 mt-2.5">
                <QuickBtn
                  active={totalPaise === fullOutstanding}
                  onClick={() => onAmountChange((Number(fullOutstanding) / 100).toString())}
                >
                  Full · {formatINR(fullOutstanding)}
                </QuickBtn>
                <QuickBtn
                  active={totalPaise > 0n && totalPaise < fullOutstanding}
                  onClick={() => onAmountChange("")}
                >
                  Part
                </QuickBtn>
              </div>
            )}
            {loading && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-text-dim">
                <Loader2 size={11} className="animate-spin" />
                Loading their jobs and bills…
              </div>
            )}
            {projectName && projectDue != null && totalPaise > 0n && (
              <div className="mt-3 border-t border-rule pt-3 text-[12px] text-text-dim">
                {totalPaise >= projectDue ? (
                  <>This clears <span className="text-text">{projectName}</span> in full.</>
                ) : (
                  <>
                    <span className="tabular text-text">
                      {formatINR(projectDue - totalPaise)}
                    </span>
                    {" will still be to come on "}
                    <span className="text-text">{projectName}</span>.
                  </>
                )}
              </div>
            )}
          </div>
  );
}

function QuickBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 px-3.5 rounded-[8px] border text-[12px] font-medium transition-colors tabular",
        active
          ? "border-gold bg-gold/10 text-text"
          : "border-rule text-text-dim hover:text-text hover:border-text-dim",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
