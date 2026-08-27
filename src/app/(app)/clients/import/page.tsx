// Data migration — bringing the client's existing books into the system.
//
// Without this, a business with ten years of history has to retype it,
// and what actually happens is that staff keep the old spreadsheet open
// beside the new system and the rollout fails quietly.

import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { requirePermission } from "@/kernel/rbac/guard";
import { MigrationForm } from "./_components/MigrationForm";

export const dynamic = "force-dynamic";

export default async function ClientImportPage() {
  const ctx = await devContext();
  requirePermission(ctx, "client.create");

  return (
    <>
      <Topbar
        title="Import clients & projects"
        eyebrow="Bring your existing customer list and job history into Mandovara"
      />
      <MigrationForm />
    </>
  );
}
