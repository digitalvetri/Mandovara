// Vendors repository.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface VendorRow {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  gstin: string | null;
  stateCode: string;
  paymentTerms: number;
  status: string;
  createdAt: Date;
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

  const where: Record<string, unknown> = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { name:   { contains: s, mode: "insensitive" } },
      { mobile: { contains: s } },
      { gstin:  { contains: s, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.vendor.findMany({
      where, orderBy: { name: "asc" }, skip, take: pageSize,
      select: {
        id: true, name: true, mobile: true, email: true, gstin: true,
        stateCode: true, paymentTerms: true, status: true, createdAt: true,
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
      id: true, name: true, mobile: true, email: true, gstin: true,
      stateCode: true, paymentTerms: true, status: true, createdAt: true,
    },
  });
}

export interface VendorPickerRow {
  id: string; name: string; stateCode: string; paymentTerms: number;
}
export async function listVendorsForPicker(ctx: RequestContext): Promise<VendorPickerRow[]> {
  requirePermission(ctx, "vendor.view");
  const db = scoped(ctx);
  const rows = await db.vendor.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, stateCode: true, paymentTerms: true },
  });
  return rows;
}
