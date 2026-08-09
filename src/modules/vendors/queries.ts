import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface VendorRow {
  id: string;
  code: string;
  name: string;
  mobile: string;
  email: string | null;
  gstin: string | null;
  paymentTermsDays: number;
  leadTimeDays: number;
  rating: number | null;
}

export interface ListVendorsResult {
  rows: VendorRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listVendors(
  ctx: RequestContext,
  q: { search?: string; page?: number; pageSize?: number },
): Promise<ListVendorsResult> {
  requirePermission(ctx, "vendor.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? 25, 100);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where = q.search?.trim()
    ? {
        OR: [
          { name:   { contains: q.search.trim(), mode: "insensitive" as const } },
          { mobile: { contains: q.search.trim() } },
          { gstin:  { contains: q.search.trim(), mode: "insensitive" as const } },
          { code:   { contains: q.search.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    db.vendor.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      select: {
        id: true, code: true, name: true, mobile: true, email: true,
        gstin: true, paymentTermsDays: true, leadTimeDays: true, rating: true,
      },
    }),
    db.vendor.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}

export async function getVendor(ctx: RequestContext, id: string): Promise<VendorRow | null> {
  requirePermission(ctx, "vendor.view");
  const db = scoped(ctx);
  return db.vendor.findUnique({
    where: { id },
    select: {
      id: true, code: true, name: true, mobile: true, email: true,
      gstin: true, paymentTermsDays: true, leadTimeDays: true, rating: true,
    },
  });
}

export interface VendorPickerRow {
  id: string;
  name: string;
  paymentTermsDays: number;
}

export async function listVendorsForPicker(ctx: RequestContext): Promise<VendorPickerRow[]> {
  requirePermission(ctx, "vendor.view");
  const db = scoped(ctx);
  return db.vendor.findMany({
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, paymentTermsDays: true },
  });
}
