"use client";

// Delete-project button for the project detail header.
//
// Thin wrapper around the shared DangerDeleteButton, exactly as
// DeleteClientAction is: the page has already computed the blockers
// server-side, so the dialog can say *why* it will refuse before the
// user clicks Delete rather than after. The action re-checks the same
// blockers, so a page left open while an invoice was raised elsewhere
// still cannot slip a delete through.

import { DangerDeleteButton } from "@/components/data/DangerDeleteButton";
import { deleteProject } from "@/modules/projects/actions-delete";
import { describeBlockers, type DeleteBlocker } from "@/modules/projects/delete-shared";

interface Props {
  projectId:   string;
  projectName: string;
  blockers:    DeleteBlocker[];
}

export function DeleteProjectAction({ projectId, projectName, blockers }: Props) {
  const blocked = blockers.length > 0;
  const reason  = blocked ? describeBlockers(blockers) : undefined;

  return (
    <DangerDeleteButton
      entityLabel="project"
      entityName={projectName}
      redirectTo="/projects"
      extraWarning={
        reason ??
        "Rooms, measurements, milestones, tasks, site logs and draft quotations for this project are removed with it."
      }
      onDelete={() =>
        blocked
          ? Promise.resolve({ ok: false, error: reason })
          : deleteProject(projectId)
      }
    />
  );
}
