import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listBackfillPlan } from "@/modules/admin/backfill-catalog-pdfs";
import { BackfillForm } from "./_components/BackfillForm";

export const dynamic = "force-dynamic";

export default async function BackfillPdfsPage() {
  const ctx = await devContext();
  const canDo = ctx.permissions.has("catalog.update");

  if (!canDo) {
    return (
      <>
        <Topbar title="Backfill catalog PDFs" />
        <div className="rounded-[14px] border border-rule bg-surface p-8 text-center text-[13px] text-text-dim">
          You need the “Catalog · Update” permission to use this page.
        </div>
      </>
    );
  }

  const plan = await listBackfillPlan();

  return (
    <>
      <Topbar
        title="Backfill catalog PDFs"
        eyebrow="Register missing collections for Platinum Range and Ready Stock"
      />
      <BackfillForm initialPlan={plan} />
    </>
  );
}
