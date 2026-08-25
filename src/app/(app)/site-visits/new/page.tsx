// /site-visits/new — dedicated route so the project page's "Book install
// visit" CTA has somewhere to land. Renders the existing NewVisitButton
// modal auto-opened, with project + purpose prefilled from URL params.

import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listProjectsForSelect } from "@/modules/projects/queries";
import { NewVisitButton } from "../_components/NewVisitButton";

export const dynamic = "force-dynamic";

interface SearchParams {
  projectId?: string;
  purpose?:   string;
}

export default async function NewSiteVisitPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const { projectId, purpose } = await searchParams;
  const ctx = await devContext();
  const projects = await listProjectsForSelect(ctx);

  // On close/submit, take the user back to the project page they came
  // from — otherwise the modal closes onto a blank page and looks broken.
  const returnHref = projectId ? `/projects/${projectId}` : `/site-visits`;

  return (
    <>
      <Topbar
        title="Book install visit"
        eyebrow="Pick a date and assign an installer. This is the visit that hands the space back to the client."
      />
      <NewVisitButton
        projects={projects}
        autoOpen
        defaultProjectId={projectId}
        defaultPurpose={purpose ?? "HANDOVER"}
        onCloseHref={returnHref}
      />
    </>
  );
}
