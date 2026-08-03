import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listClientsForProject } from "@/modules/projects/queries";
import { listBranches } from "@/modules/branches/queries";
import { ProjectForm } from "../_components/ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const ctx = await devContext();
  const [clients, branches] = await Promise.all([
    listClientsForProject(ctx),
    listBranches(ctx),
  ]);
  return (
    <>
      <Topbar title="New project" eyebrow="Milestones and tasks are added on the detail page after creating." />
      <ProjectForm clients={clients} branches={branches} />
    </>
  );
}
