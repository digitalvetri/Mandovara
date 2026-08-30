"use server";

// One-shot backfill for the "Platinum Range" and "Ready Stock" brands.
//
// Context (2026-08-30): the two Google Drive folders grew beyond what the
// original scripts/register-catalog-pdfs.mjs registered. The PDFs are all
// on disk under /app/public/catalog/pdfs/ but ~19 of the 30 Platinum Range
// and 10 of 11 Ready Stock Collections are missing DB rows. The one file
// that is still not on disk (READY STOCK · casa.pdf, 75 MB from Drive)
// can be uploaded via uploadMissingCatalogPdf() below.
//
// Idempotent: safe to run repeatedly.

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { PDFS_DIR } from "@/modules/catalog/pdf-paths";
import type { BackfillReport, BackfillPlan } from "./backfill-catalog-pdfs-types";
import { BRAND_ENTRIES, UPLOADABLE_SLUGS } from "./backfill-catalog-pdfs-data";

const SAFE_KEY = /^[a-zA-Z0-9_-]+\.pdf$/;

export async function backfillCatalogPdfs(): Promise<BackfillReport> {
  const report: BackfillReport = {
    ok: false, created: [], updated: [], unchanged: [],
    skippedConflict: [], missingOnDisk: [],
    finalCounts: { platinum: 0, readyStock: 0 },
  };

  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.update");
    const db = scoped(ctx);

    const targetBrandNames = Object.keys(BRAND_ENTRIES);
    const allSlugs = Object.values(BRAND_ENTRIES).flat().map(([, slug]) => slug);

    // Build a map of slug → "OtherBrand · CollectionName" for every collection
    // *outside* our two target brands that already owns one of our slugs.
    // Registering the same slug under a target brand would create a duplicate
    // card in the UI — we skip and surface the conflict instead.
    const foreignOwners = new Map<string, string>();
    const foreignRows = await db.collection.findMany({
      where: {
        organizationId: ctx.orgId,
        catalogPdfKey:  { in: allSlugs },
        brand:          { name: { notIn: targetBrandNames } },
      },
      select: { catalogPdfKey: true, name: true, brand: { select: { name: true } } },
    });
    for (const row of foreignRows) {
      if (row.catalogPdfKey && !foreignOwners.has(row.catalogPdfKey)) {
        foreignOwners.set(row.catalogPdfKey, `${row.brand.name} · ${row.name}`);
      }
    }

    for (const [brandName, entries] of Object.entries(BRAND_ENTRIES)) {
      let brand = await db.brand.findUnique({
        where:  { organizationId_name: { organizationId: ctx.orgId, name: brandName } },
        select: { id: true },
      });
      if (!brand) {
        brand = await db.brand.create({
          data:   { organizationId: ctx.orgId, name: brandName, isActive: true },
          select: { id: true },
        });
      }

      for (const [orig, slug, name] of entries) {
        const label = `${brandName} · ${name}`;
        const diskPath = path.join(PDFS_DIR, slug);
        if (!existsSync(diskPath)) {
          report.missingOnDisk.push({ brand: brandName, slug, orig });
          continue;
        }

        const existing = await db.collection.findUnique({
          where: {
            organizationId_brandId_name: {
              organizationId: ctx.orgId,
              brandId:        brand.id,
              name,
            },
          },
          select: { id: true, catalogPdfKey: true },
        });

        if (existing) {
          if (existing.catalogPdfKey === slug) {
            report.unchanged.push(label);
          } else {
            await db.collection.update({
              where: { id: existing.id },
              data:  { catalogPdfKey: slug, isActive: true },
            });
            report.updated.push(label);
          }
          continue;
        }

        // No existing collection with this exact name under this brand.
        // Before creating one, check the slug isn't already owned by another
        // brand's collection — that would produce a visible duplicate.
        const foreignOwner = foreignOwners.get(slug);
        if (foreignOwner) {
          report.skippedConflict.push({ brand: brandName, name, slug, ownedBy: foreignOwner });
          continue;
        }

        await db.collection.create({
          data: {
            organizationId: ctx.orgId,
            brandId:        brand.id,
            name,
            family:         "WALLPAPER",
            catalogPdfKey:  slug,
            isActive:       true,
          },
        });
        report.created.push(label);
      }
    }

    report.finalCounts.platinum = await db.collection.count({
      where: { organizationId: ctx.orgId, brand: { name: "Platinum Range" }, catalogPdfKey: { not: null } },
    });
    report.finalCounts.readyStock = await db.collection.count({
      where: { organizationId: ctx.orgId, brand: { name: "Ready Stock" }, catalogPdfKey: { not: null } },
    });

    revalidatePath("/products");
    revalidatePath("/products/brand");
    report.ok = true;
    return report;
  } catch (err) {
    console.error("backfillCatalogPdfs failed:", err);
    report.error = err instanceof Error ? err.message : "Backfill failed.";
    return report;
  }
}

export async function uploadMissingCatalogPdf(
  formData: FormData,
): Promise<{ ok: boolean; error?: string; slug?: string }> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.update");

    const slug = formData.get("slug");
    const file = formData.get("pdf");

    if (typeof slug !== "string" || !SAFE_KEY.test(slug)) {
      return { ok: false, error: "Invalid target filename." };
    }
    if (!UPLOADABLE_SLUGS.has(slug)) {
      return { ok: false, error: `Slug "${slug}" is not in the backfill mapping.` };
    }
    if (!file || typeof file === "string") {
      return { ok: false, error: "No PDF file provided." };
    }
    const f = file as File;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      return { ok: false, error: "Only PDF files are allowed." };
    }
    if (f.size > 200 * 1024 * 1024) {
      return { ok: false, error: "PDF must be under 200 MB." };
    }

    await mkdir(PDFS_DIR, { recursive: true });
    const dest = path.join(PDFS_DIR, slug);
    const buf  = Buffer.from(await f.arrayBuffer());
    await writeFile(dest, buf);

    return { ok: true, slug };
  } catch (err) {
    console.error("uploadMissingCatalogPdf failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function listBackfillPlan(): Promise<BackfillPlan> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.update");
    const db = scoped(ctx);

    const targetBrandNames = Object.keys(BRAND_ENTRIES);
    const allSlugs = Object.values(BRAND_ENTRIES).flat().map(([, slug]) => slug);

    // slug → "OtherBrand · CollectionName" for cross-brand conflicts.
    const foreignOwners = new Map<string, string>();
    const foreignRows = await db.collection.findMany({
      where: {
        organizationId: ctx.orgId,
        catalogPdfKey:  { in: allSlugs },
        brand:          { name: { notIn: targetBrandNames } },
      },
      select: { catalogPdfKey: true, name: true, brand: { select: { name: true } } },
    });
    for (const row of foreignRows) {
      if (row.catalogPdfKey && !foreignOwners.has(row.catalogPdfKey)) {
        foreignOwners.set(row.catalogPdfKey, `${row.brand.name} · ${row.name}`);
      }
    }

    const brands: BackfillPlan["brands"] = [];

    for (const [brandName, entries] of Object.entries(BRAND_ENTRIES)) {
      const brand = await db.brand.findUnique({
        where: { organizationId_name: { organizationId: ctx.orgId, name: brandName } },
        select: { id: true },
      });

      const currentRows = brand
        ? await db.collection.findMany({
            where:  { organizationId: ctx.orgId, brandId: brand.id, catalogPdfKey: { not: null } },
            select: { id: true, name: true, catalogPdfKey: true },
          })
        : [];

      const registeredSlugs = new Set(currentRows.map((r) => r.catalogPdfKey!));
      const expectedSlugs = new Set(entries.map(([, slug]) => slug));

      // Collections currently pointing at a file that isn't on disk, and
      // whose key isn't one of the expected slugs → likely stale rows from
      // an earlier run with a different slug scheme. Surface for cleanup.
      const orphans: BackfillPlan["brands"][number]["orphans"] = [];
      for (const row of currentRows) {
        const key = row.catalogPdfKey!;
        if (expectedSlugs.has(key)) continue;
        if (existsSync(path.join(PDFS_DIR, key))) continue;
        orphans.push({ id: row.id, name: row.name, catalogPdfKey: key });
      }

      brands.push({
        brand: brandName,
        entries: entries.map(([orig, slug, name]) => ({
          orig, slug, name,
          onDisk:       existsSync(path.join(PDFS_DIR, slug)),
          registered:   registeredSlugs.has(slug),
          conflictWith: foreignOwners.get(slug) ?? null,
        })),
        orphans,
      });
    }

    return { ok: true, brands };
  } catch (err) {
    console.error("listBackfillPlan failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load plan.",
      brands: [],
    };
  }
}
