// Responsive grid wrapper for the /products list.
// Breakpoints: 4 cols ≥ 1440, 3 cols ≥ 1080, 2 cols ≥ 640, 1 col below.

import { ProductCard } from "./ProductCard";
import type { ProductRow } from "@/modules/products/queries";

export function ProductGrid({ rows }: { rows: ProductRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
      {rows.map((r) => <ProductCard key={r.id} row={r} />)}
    </div>
  );
}
