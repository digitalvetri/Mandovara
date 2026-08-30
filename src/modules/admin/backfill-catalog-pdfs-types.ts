// Types for backfill-catalog-pdfs.ts — must live outside the "use server"
// file (a "use server" file may only export async functions).

export interface BackfillReport {
  ok:        boolean;
  error?:    string;
  created:   string[];
  updated:   string[];
  unchanged: string[];
  skippedConflict: Array<{ brand: string; name: string; slug: string; ownedBy: string }>;
  missingOnDisk:   Array<{ brand: string; slug: string; orig: string }>;
  finalCounts: { platinum: number; readyStock: number };
}

export interface BackfillPlanEntry {
  orig:       string;
  slug:       string;
  name:       string;
  onDisk:     boolean;
  registered: boolean;
  // If the slug is already the catalogPdfKey on a Collection under a
  // DIFFERENT brand, registering it here would produce a duplicate — the
  // backfill will skip. Formatted as "Brand · Collection".
  conflictWith: string | null;
}

export interface BackfillPlanBrand {
  brand:   string;
  entries: BackfillPlanEntry[];
  // Collections under THIS brand whose catalogPdfKey no longer resolves to
  // a file on disk. Surfaced so the user can clean them up manually — the
  // backfill will not delete them automatically.
  orphans: Array<{ id: string; name: string; catalogPdfKey: string }>;
}

export interface BackfillPlan {
  ok:     boolean;
  error?: string;
  brands: BackfillPlanBrand[];
}
