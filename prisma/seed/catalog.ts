import { Prisma, PrismaClient } from "@prisma/client";
import { CATEGORIES } from "./data";
import { makeRng } from "./rng";

export async function seedCatalog(db: PrismaClient, orgId: string, seed = 43) {
  const rng = makeRng(seed);
  const productsPerCategory = 150;

  // Categories + spec templates
  const categoryIds = new Map<string, string>();
  let sortOrder = 0;
  for (const cat of CATEGORIES) {
    const c = await db.category.create({ data: { orgId, name: cat.name, sortOrder: sortOrder++ } });
    categoryIds.set(cat.slug, c.id);
    await db.specTemplate.create({ data: { categoryId: c.id, fields: cat.specFields as unknown as Prisma.InputJsonValue } });
  }

  // Products (bulk)
  const productRows: Prisma.ProductCreateManyInput[] = [];
  let codeCounter = 10001;
  for (const cat of CATEGORIES) {
    const categoryId = categoryIds.get(cat.slug)!;
    for (let i = 0; i < productsPerCategory; i++) {
      const brand = cat.brands[rng.int(0, cat.brands.length - 1)]!;
      const specs: Record<string, string> = {};
      for (const f of cat.specFields) {
        if (f.type === "select" && f.options && f.options.length > 0) {
          specs[f.key] = f.options[rng.int(0, f.options.length - 1)]!;
        } else if (f.type === "text") {
          specs[f.key] = `${rng.int(4, 24)}mm`;
        }
      }
      const pattern = cat.namePatterns[rng.int(0, cat.namePatterns.length - 1)]!;
      const detail = specs.diameter ?? specs.size ?? specs.grade ?? "";
      const name = [brand, pattern, detail].filter(Boolean).join(" ").trim();
      productRows.push({
        orgId,
        code: `${cat.slug.slice(0, 3).toUpperCase()}${String(codeCounter++)}`,
        name, categoryId,
        hsn: `${cat.hsnPrefix}${rng.int(10, 99)}`,
        uom: cat.uom, uomPrecision: cat.uomPrecision,
        gstRate: new Prisma.Decimal(cat.gstRate),
        specs: specs as unknown as Prisma.InputJsonValue,
        status: "ACTIVE",
        reorderLevel: new Prisma.Decimal(rng.pick([10, 25, 50, 100, 250, 500])),
        minStock: new Prisma.Decimal(rng.pick([5, 10, 25, 50])),
        trackBatch: cat.slug === "cement" || cat.slug === "paint",
        trackSerial: false,
      });
    }
  }
  await db.product.createMany({ data: productRows });
  const products = await db.product.findMany({ where: { orgId }, select: { id: true, code: true } });
  const productIdByCode = new Map(products.map((p) => [p.code, p.id]));

  // Prices — cost / MRP / dealer
  const priceRows: Prisma.ProductPriceCreateManyInput[] = [];
  const effectiveFrom = new Date(2025, 0, 1);
  for (const p of products) {
    const cost = BigInt(rng.int(50, 5000) * 100);
    const mrp = cost + (cost * BigInt(rng.int(20, 45))) / 100n;
    const dealer = cost + (cost * BigInt(rng.int(10, 20))) / 100n;
    priceRows.push(
      { productId: p.id, tier: "COST",   amount: cost,   effectiveFrom },
      { productId: p.id, tier: "MRP",    amount: mrp,    effectiveFrom },
      { productId: p.id, tier: "DEALER", amount: dealer, effectiveFrom },
    );
  }
  await db.productPrice.createMany({ data: priceRows });

  return { productIds: products.map((p) => p.id), productIdByCode, categoryIds };
}
