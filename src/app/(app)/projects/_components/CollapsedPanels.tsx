"use client";

// Tasks + Site Logs collapse to a single 34px row when empty (spec §1).
// Clicking expands the panel; the existing ProjectPanels renders the
// full kanban and log list inline. Add form only appears on demand.
//
// This is a thin wrapper — the heavy content lives in ProjectPanels.

import { useState } from "react";
import { ChevronRight, ChevronDown, ListChecks, ClipboardList } from "lucide-react";
import type { ProjectTask, ProjectSiteLog } from "@/modules/projects/queries";
import { ProjectPanels } from "./ProjectPanels";

interface Props {
  projectId: string;
  tasks: ProjectTask[];
  siteLogs: ProjectSiteLog[];
}

export function CollapsedPanels({ projectId, tasks, siteLogs }: Props) {
  const hasAnyContent = tasks.length > 0 || siteLogs.length > 0;
  const [open, setOpen] = useState(hasAnyContent);

  if (!hasAnyContent && !open) {
    return (
      <div className="space-y-2">
        <CollapsedRow
          icon={<ListChecks size={13} />}
          label="Tasks"
          countText="No tasks yet"
          onClick={() => setOpen(true)}
        />
        <CollapsedRow
          icon={<ClipboardList size={13} />}
          label="Site logs"
          countText="No logs yet"
          onClick={() => setOpen(true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasAnyContent && (
        <div className="flex items-center justify-between rounded-[10px] border border-rule bg-surface px-4 py-2 text-[11.5px] text-text-dim">
          Expanded — add your first task or log below.
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-text-dim hover:text-text"
          >
            Collapse
          </button>
        </div>
      )}
      <ProjectPanels
        projectId={projectId}
        milestones={[]}
        tasks={tasks}
        siteLogs={siteLogs}
        hideMilestones
      />
    </div>
  );
}

function CollapsedRow({
  icon, label, countText, onClick,
}: { icon: React.ReactNode; label: string; countText: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[10px] border border-rule bg-surface px-4 py-2.5 text-left text-[12px] transition-colors hover:bg-surface-2/40"
    >
      <ChevronRight size={12} className="text-text-dim shrink-0" />
      <span className="text-text-dim">{icon}</span>
      <span className="text-text">{label}</span>
      <span className="ml-auto text-[11px] text-text-dim">{countText}</span>
    </button>
  );
}

// Re-export for consistency with the other panel imports on the page.
export { ChevronDown };
