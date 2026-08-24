import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { ProjectEditForm } from "../_components/ProjectEditForm";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const db = scoped(ctx);

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true, name: true, orderValue: true,
      expectedInstallAt: true, siteContactName: true, siteContactMobile: true,
      number: true, client: { select: { name: true } },
    },
  });
  if (!project) notFound();

  return (
    <>
      <Topbar
        title={`Edit — ${project.number}`}
        eyebrow={`${project.client.name} · Client and branch cannot be changed after creation.`}
      />
      <ProjectEditForm
        id={project.id}
        initial={{
          name:               project.name,
          orderValue:         (project.orderValue / 100n).toString(),
          expectedInstallAt:  project.expectedInstallAt?.toISOString().slice(0, 10) ?? "",
          siteContactName:    project.siteContactName ?? "",
          siteContactMobile:  project.siteContactMobile ?? "",
        }}
      />
    </>
  );
}
