// /catalogues — flat, name-only listing of every catalogue in the app,
// grouped by product family. New catalogues are added via a paste-many
// modal in the header. Distinct from /products, which surfaces the
// PDF-per-brand view.

import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { listCataloguesByFamily } from "@/modules/catalog/catalogues-queries";
import { AddCataloguesModal } from "./_components/AddCataloguesModal";
import { CatalogueRow } from "./_components/CatalogueRow";

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
        <div className="space-y-6 pb-10">
          {groups.map((g) => (
            <section key={g.family} className="rounded-[14px] bg-surface border border-rule shadow-sm overflow-hidden">
              <header className="flex items-baseline justify-between px-5 py-3 border-b border-rule bg-ink/10">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-dim font-semibold">
                  {g.label}
                </div>
                <div className="text-[11.5px] text-text-dim tabular">
                  {g.rows.length}
                </div>
              </header>
              <ul>
                {g.rows.map((r) => (
                  <CatalogueRow
                    key={r.id}
                    row={r}
                    canDelete={canDelete}
                  />
                ))}
              </ul>
            </section>
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
          ? "Click Add catalogues, pick a category, and paste a list of names — one per line."
          : "Nothing to show yet. Ask an owner to add catalogues."}
      </div>
      {canAdd && <AddCataloguesModal />}
    </div>
  );
}
