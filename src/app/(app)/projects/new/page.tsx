import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listClientsForProject } from "@/modules/projects/queries";
import { listBranches } from "@/modules/branches/queries";
import { ProjectForm } from "../_components/ProjectForm";

export const dynamic = "force-dynamic";

interface Props {
  // Next 16 passes searchParams as a Promise to server pages.
  searchParams: Promise<{ client?: string }>;
}

export default async function NewProjectPage({ searchParams }: Props) {
  const ctx = await devContext();
  const [clients, branches, { client: preselectedClientId }] = await Promise.all([
    listClientsForProject(ctx),
    listBranches(ctx),
    searchParams,
  ]);
  return (
    <>
      <Topbar title="New project" eyebrow="Milestones and tasks are added on the detail page after creating." />
      <ProjectForm
        clients={clients}
        branches={branches}
        defaultClientId={preselectedClientId}
      />
    </>
  );
}
