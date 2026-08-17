"use client";

// Five-step tour that runs on the first visit to /accounts.
// docs/ACCOUNTS-PAGE.md §10: "he should never need to be taught this
// page." The tour is the safety net for the first two minutes.
//
// - Fires automatically once (localStorage flag).
// - Skippable with the X or Esc; replayable via ?tour=1 in the URL.
// - Not anchored to specific DOM nodes — a centred modal walk with
//   plain sentences. Anchored highlighters are fragile across the
//   phone / desktop / seed-empty variants; a modal is bulletproof.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

const STORAGE_KEY = "mv_accounts_tour_seen_v1";

interface Step {
  title:    string;
  body:     string;
}

const STEPS: Step[] = [
  {
    title: "This page answers five questions",
    body:  "Am I okay? Who do I chase? Did anything come in? What am I spending? Can I pay my people? Everything you see is one of those five. Nothing else.",
  },
  {
    title: "Four numbers at the top",
    body:  "To collect · Came in · To pay · Spent. Each carries a plain-English sub-line so you never read a bare number. Tap any card to open the list behind it.",
  },
  {
    title: "The Chase List is the main tool",
    body:  "The top five clients to call today, ranked automatically by amount, days late, and last time you spoke. Every row has WhatsApp, Got paid, and Promised — one tap each.",
  },
  {
    title: "Charts are shortcuts, not decoration",
    body:  "Money in vs out shows if you're growing. How long they've owed shows how bad your outstanding really is. Where the money goes and How people pay you finish the picture. Every bar links to its data.",
  },
  {
    title: "Record a payment in three taps",
    body:  "The + Record Payment button opens: amount → how paid → save. Extra beyond the bills is 'kept for later', never lost. That's it.",
  },
];

export function FirstRunTour() {
  const router     = useRouter();
  const pathname   = usePathname();
  const params     = useSearchParams();
  const requested  = params.get("tour") === "1";
  const [open, setOpen]     = useState(false);
  const [step, setStep]     = useState(0);

  useEffect(() => {
    // Only decide once per mount.
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (requested || !seen) setOpen(true);
  }, [requested]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // `close`, `next`, `prev` are defined in the same closure and
    // reference `step` — intentionally re-binding on every step change.
  }, [open, step]);

  function close() {
    setOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    // Strip ?tour=1 from the URL so a refresh doesn't re-open.
    if (requested) {
      router.replace(pathname);
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else close();
  }
  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (!open) return null;

  const cur = STEPS[step]!;

  return (
    <div
      className="fixed inset-0 z-40 bg-ink/80 backdrop-blur-sm flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="w-full max-w-[440px] rounded-[14px] bg-surface border border-rule shadow-2xl p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-gold">
            <Sparkles size={12} strokeWidth={2} />
            Quick tour · {step + 1} of {STEPS.length}
          </div>
          <button
            type="button"
            onClick={close}
            className="h-7 w-7 rounded-[6px] grid place-items-center text-text-dim hover:text-text hover:bg-surface-hover"
            aria-label="Close tour"
          >
            <X size={13} />
          </button>
        </div>

        <h2 id="tour-title" className="font-display text-[20px] font-semibold text-text mb-2.5 leading-snug">
          {cur.title}
        </h2>
        <p className="text-[13px] text-text-dim leading-relaxed mb-5">
          {cur.body}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? "w-6 bg-gold" : "w-2 bg-rule"
              }`}
              aria-hidden
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={close}
            className="text-[11.5px] text-text-dim hover:text-text transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prev}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-[8px] border border-rule text-[12px] text-text-dim hover:text-text hover:border-text-dim transition-colors"
              >
                <ChevronLeft size={12} />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 h-9 px-4 rounded-[8px] bg-gold text-ink text-[12.5px] font-semibold hover:bg-gold-strong transition-colors"
            >
              {step === STEPS.length - 1 ? "Got it" : "Next"}
              {step < STEPS.length - 1 && <ChevronRight size={12} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
