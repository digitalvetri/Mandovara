import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { WipeForm } from "./_components/WipeForm";

export const dynamic = "force-dynamic";

export default async function AdminWipePage() {
  const ctx = await devContext();
  const canWipe = ctx.permissions.has("admin.wipe");

  return (
    <>
      <Topbar
        title="Wipe transactional data"
        eyebrow="Destructive. Preserves the catalog, all stock, and every login account."
      />
      {canWipe ? (
        <WipeForm />
      ) : (
        <div className="rounded-[14px] border border-rule bg-surface p-8 text-center text-[13px] text-text-dim">
          You need the OWNER role to run this.
        </div>
      )}
    </>
  );
}
