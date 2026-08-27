"use client";

// Thin orchestrator — each panel lives in its own file so none exceed 300 lines.
// SiteLogs panel was removed from this surface (kept as module for reuse).

import type { ProjectMilestone, ProjectTask, ProjectMember } from "@/modules/projects/queries";
import { Milestones } from "./_Milestones";
import { TaskBoard } from "./_TaskBoard";

interface Props {
  projectId: string;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  members: ProjectMember[];
  /** When true, skip the legacy Milestones panel — the redesign renders
   *  its own MilestonesPanel higher up. */
  hideMilestones?: boolean;
}

export function ProjectPanels(p: Props) {
  return (
    <div className="space-y-4">
      {!p.hideMilestones && (
        <Milestones projectId={p.projectId} milestones={p.milestones} />
      )}
      <TaskBoard projectId={p.projectId} tasks={p.tasks} members={p.members} />
    </div>
  );
}
