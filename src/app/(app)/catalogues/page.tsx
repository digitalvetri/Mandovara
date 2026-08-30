// /catalogues — flat, name-only listing of every catalogue in the app,
// grouped by product family. New catalogues are added via a paste-many
// modal in the header. Distinct from /products, which surfaces the
// PDF-per-brand view.

import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { listCataloguesByFamily } from "@/modules/catalog/catalogues-queries";
import { AddCataloguesModal } from "./_components/AddCataloguesModal";
import { CategorySection } from "./_components/CategorySection";
import { LoadStarterListButton } from "./_components/LoadStarterListButton";

export const dynamic = "force-dynamic";

export default async function CataloguesPage() {
  const ctx      = await devContext();
  const canAdd   = can(ctx, "catalog.create");
  const canDelete = can(ctx, "catalog.delete");
  const groups   = await listCataloguesByFamily(ctx);

  const total = groups.reduce((s, g) => s + g.rows.length, 0);

  return (
    <>
      <Topbar
        title="Catalogues"
        eyebrow={total > 0
          ? `${total} catalogue${total === 1 ? "" : "s"} across ${groups.length} categor${groups.length === 1 ? "y" : "ies"}`
          : "No catalogues yet"}
        actions={canAdd ? <AddCataloguesModal /> : undefined}
      />

      {total === 0 ? (
        <EmptyState canAdd={canAdd} />
      ) : (
        <div className="space-y-3 pb-10">
          {groups.map((g) => (
            <CategorySection
              key={g.family}
              family={g.family}
              label={g.label}
              rows={g.rows}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}

function EmptyState({ canAdd }: { canAdd: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-[14px] font-medium text-text-dim mb-2">
        No catalogues added yet.
      </div>
      <div className="text-[12.5px] text-text-dim/70 mb-6 max-w-[380px]">
        {canAdd
          ? "Load the 713-name starter list from your Excel, or add one category at a time."
          : "Nothing to show yet. Ask an owner to add catalogues."}
      </div>
      {canAdd && (
        <div className="flex items-center gap-2">
          <LoadStarterListButton />
          <AddCataloguesModal />
        </div>
      )}
    </div>
  );
}
