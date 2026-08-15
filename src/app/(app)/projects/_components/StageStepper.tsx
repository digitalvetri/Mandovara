// Stage stepper: dot chain across the top of the project page.
// completed = solid gold dot, current = gold ring, future = rule.
// Not a coloured pill — this is the calm, ordered pattern the spec asks
// for (docs/BUILD-SPEC.md project-detail §6).

import { PROJECT_STAGES, STAGE_SHORT_LABEL } from "@/modules/projects/next-action";

interface Props {
  stage: string;
}

export function StageStepper({ stage }: Props) {
  const currentIndex = PROJECT_STAGES.indexOf(stage);
  const cancelled = stage === "CANCELLED";

  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Project stage">
      {PROJECT_STAGES.map((s, i) => {
        const done    = !cancelled && i <  currentIndex;
        const current = !cancelled && i === currentIndex;
        const label   = STAGE_SHORT_LABEL[s] ?? s;

        return (
          <li key={s} className="flex items-center gap-2 shrink-0">
            <span
              aria-current={current ? "step" : undefined}
              className={[
                "inline-flex items-center gap-1.5 text-[11.5px] tracking-[0.02em]",
                done    ? "text-text"     :
                current ? "text-text"     :
                          "text-text-dim",
              ].join(" ")}
            >
              <Dot state={done ? "done" : current ? "current" : "future"} />
              {label}
            </span>
            {i < PROJECT_STAGES.length - 1 && (
              <span aria-hidden className="h-px w-6 bg-rule" />
            )}
          </li>
        );
      })}
      {cancelled && (
        <li className="ml-2 rounded-[4px] border border-fault/40 px-2 py-0.5 text-[10.5px] uppercase tracking-[0.14em] text-fault">
          Cancelled
        </li>
      )}
    </ol>
  );
}

function Dot({ state }: { state: "done" | "current" | "future" }) {
  if (state === "done") {
    return <span aria-hidden className="h-2 w-2 rounded-full bg-gold" />;
  }
  if (state === "current") {
    return (
      <span aria-hidden className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-gold" />
        <span className="h-1 w-1 rounded-full bg-gold" />
      </span>
    );
  }
  return <span aria-hidden className="h-2 w-2 rounded-full border border-rule" />;
}
