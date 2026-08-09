"use client";

// Thin orchestrator — each panel lives in its own file so none exceed 300 lines.

import type { ProjectMilestone, ProjectTask, ProjectSiteLog } from "@/modules/projects/queries";
import { Milestones } from "./_Milestones";
import { TaskBoard } from "./_TaskBoard";
import { SiteLogs } from "./_SiteLogs";

interface Props {
  projectId: string;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  siteLogs: ProjectSiteLog[];
}

export function ProjectPanels(p: Props) {
  return (
    <div className="space-y-4">
      <Milestones projectId={p.projectId} milestones={p.milestones} />
      <TaskBoard projectId={p.projectId} tasks={p.tasks} />
      <SiteLogs projectId={p.projectId} logs={p.siteLogs} />
    </div>
  );
}
