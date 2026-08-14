// Empty state — in-voice for a design house. Copy differs based on
// whether the user is actively filtering (something specific missed)
// vs. the catalogue is genuinely empty.

import Link from "next/link";
import type { Route } from "next";

export function EmptyResults({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-20 text-center px-6">
        <p className="font-display italic text-[16px] text-text mb-2 tracking-[-0.005em]">
          The catalogue does not contain that pattern.
        </p>
        <p className="text-[12px] text-text-dim">
          Loosen a filter, or try a different search term.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[14px] bg-surface border border-rule py-20 text-center px-6">
      <p className="font-display italic text-[16px] text-text mb-2 tracking-[-0.005em]">
        The catalogue is empty.
      </p>
      <p className="text-[12px] text-text-dim">
        Add your first SKU manually or via Excel import. →{" "}
        <Link href={"/products/new" as Route} className="text-accent hover:underline">
          New product
        </Link>
      </p>
    </div>
  );
}
