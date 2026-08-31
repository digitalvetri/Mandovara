// /catalogues — the studio's shelf.
//
// Was a name-only list grouped by family. The owner's brief (2026-08-31) is
// that this is where they track WHICH catalogues they physically hold and
// who has borrowed the rest — "like library book management".
//
// So the page leads with that: four counts, a search that matches either a
// catalogue or the person holding it, and Give out / Got it back on every
// row. The family grouping moves behind a toggle; it is how you browse when
// you already have everything, which is the rarer case.
//
// Lending is recorded in SampleBook + SampleIssue — the ledger /samples
// already owned — rather than a second one. Distinct from /products, which
// surfaces the PDF-per-brand view.

import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { listCataloguesByFamily } from "@/modules/catalog/catalogues-queries";
import { listShelf, countShelf } from "@/modules/catalog/lending-queries";
import { CatalogueShelf } from "./_components/CatalogueShelf";
import { AddCataloguesModal } from "./_components/AddCataloguesModal";
import { CategorySection } from "./_components/CategorySection";
import { LoadStarterListButton } from "./_components/LoadStarterListButton";

export const dynamic = "force-dynamic";

interface SearchParams { view?: string }

export default async function CataloguesPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params    = await searchParams;
  const ctx       = await devContext();
  const canAdd    = can(ctx, "catalog.create");
  const canDelete = can(ctx, "catalog.delete");
  const canLend   = can(ctx, "catalog.update");
  const byFamily  = params.view === "family";

  const [groups, shelf] = await Promise.all([
    listCataloguesByFamily(ctx),
    listShelf(ctx),
  ]);
  const counts = countShelf(shelf);

  const total = groups.reduce((s, g) => s + g.rows.length, 0);

  return (
    <>
      <Topbar
        title="Catalogues"
        eyebrow={total > 0
          ? `${counts.withMe} on the shelf · ${counts.out} given out${counts.overdue > 0 ? ` · ${counts.overdue} overdue` : ""}`
          : "No catalogues yet"}
        actions={
          <>
            <Link
              href={(byFamily ? "/catalogues" : "/catalogues?view=family") as Route}
              className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-rule bg-surface px-4 text-[12.5px] text-text-dim transition-colors hover:border-accent/60 hover:text-text"
            >
              {byFamily ? "Shelf view" : "By category"}
            </Link>
            {canAdd && <AddCataloguesModal />}
          </>
        }
      />

      {total === 0 ? (
        <EmptyState canAdd={canAdd} />
      ) : byFamily ? (
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
      ) : (
        <CatalogueShelf rows={shelf} counts={counts} canLend={canLend} />
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
