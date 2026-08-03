import type { ProjectStage } from "./types";

export function ProjectStages({ stages }: { stages: ProjectStage[] }) {
  const max = stages.reduce((m, s) => (s.count > m ? s.count : m), 0);

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
        Projects
      </div>
      <div className="mt-1 font-display text-[18px] font-semibold text-text">
        By stage
      </div>

      <div className="mt-5 space-y-4">
        {stages.map((s) => {
          const pct = max === 0 ? 0 : (s.count / max) * 100;
          return (
            <div key={s.name}>
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="text-[12.5px] text-text">{s.name}</div>
                <div className="text-[11.5px] tabular text-text-dim">{s.count}</div>
              </div>
              <div className="h-[4px] bg-rule/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
