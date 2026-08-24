import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { POStatus } from "./schema";

// ── List POs ──────────────────────────────────────────────────────────────────

export interface PORow {
  id: string;
  number: string;
  vendorId: string;
  vendorName: string;
  date: Date;
  expectedAt: Date | null;
  status: string;
  totalValue: bigint;
  lineCount: number;
}

export interface ListPOResult {
  rows: PORow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listPOs(
  ctx: RequestContext,
  q: { search?: string; status?: POStatus | "OPEN" | "ALL"; page?: number; pageSize?: number },
): Promise<ListPOResult> {
  requirePermission(ctx, "po.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? 25, 100);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  // PurchaseOrder has no vendor relation in schema — filter by number only, join vendor after
  const numberFilter = q.search?.trim()
    ? { number: { contains: q.search.trim(), mode: "insensitive" as const } }
    : {};

  const statusFilter: Record<string, unknown> = {};
  if (q.status && q.status !== "ALL") {
    statusFilter["status"] = q.status === "OPEN"
      ? { in: ["DRAFT", "SENT", "PARTIAL"] }
      : q.status;
  }

  const where = { ...numberFilter, ...statusFilter };

  const [rawRows, total] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true, number: true, date: true, expectedAt: true,
        status: true, totalValue: true, vendorId: true,
        _count: { select: { lines: true } },
      },
    }),
    db.purchaseOrder.count({ where }),
  ]);

  // Batch fetch vendor names
  const vendorIds = [...new Set(rawRows.map((r) => r.vendorId))];
  const vendors = vendorIds.length
    ? await db.vendor.findMany({
        where: { id: { in: vendorIds } },
        select: { id: true, name: true },
      })
    : [];
  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

  return {
    rows: rawRows.map((r) => ({
      id: r.id, number: r.number, date: r.date, expectedAt: r.expectedAt,
      vendorId: r.vendorId, vendorName: vendorMap.get(r.vendorId) ?? "—",
      status: r.status, totalValue: r.totalValue,
      lineCount: r._count.lines,
    })),
    total, page, pageSize,
  };
}

// ── PO detail ─────────────────────────────────────────────────────────────────

export interface POLineRow {
  id: string;
  colourwayId: string;
  colourwayCode: string;
  colourName: string;
  designCode: string;
  unit: string;
  orderedQty: string;
  receivedQty: string;
  pendingQty: string;
  rate: bigint;
}

export interface GRNRow {
  id: string;
  number: string;
  receivedAt: Date;
  invoiceRef: string | null;
  lineCount: number;
}

export interface PODetail {
  id: string;
  number: string;
  status: string;
  vendorId: string;
  vendorName: string;
  vendorMobile: string;
  date: Date;
  expectedAt: Date | null;
  totalValue: bigint;
  lines: POLineRow[];
  grns: GRNRow[];
}

export async function getPO(ctx: RequestContext, id: string): Promise<PODetail | null> {
  requirePermission(ctx, "po.view");
  const db = scoped(ctx);
  const row = await db.purchaseOrder.findUnique({
    where: { id },
    select: {
      id: true, number: true, status: true, date: true, expectedAt: true,
      totalValue: true, vendorId: true,
      lines: {
        orderBy: { id: "asc" },
        select: { id: true, colourwayId: true, quantity: true, receivedQty: true, unit: true, rate: true },
      },
      grns: {
        orderBy: { receivedAt: "desc" },
        select: {
          id: true, number: true, receivedAt: true, invoiceRef: true,
          _count: { select: { lines: true } },
        },
      },
    },
  });
  if (!row) return null;

  // Fetch vendor separately (no relation on PO in schema)
  const vendor = await db.vendor.findUnique({
    where: { id: row.vendorId },
    select: { id: true, name: true, mobile: true },
  });

  // Fetch colourways for lines (no relation on POLine in schema)
  const colourwayIds = [...new Set(row.lines.map((l) => l.colourwayId))];
  const colourways = colourwayIds.length
    ? await db.colourway.findMany({
        where: { id: { in: colourwayIds } },
        select: {
          id: true, code: true, colourName: true,
          design: { select: { code: true } },
        },
      })
    : [];
  const cwMap = new Map(colourways.map((c) => [c.id, c]));

  return {
    id: row.id, number: row.number, status: row.status,
    vendorId: row.vendorId,
    vendorName: vendor?.name ?? "—",
    vendorMobile: vendor?.mobile ?? "—",
    date: row.date, expectedAt: row.expectedAt, totalValue: row.totalValue,
    lines: row.lines.map((l) => {
      const cw = cwMap.get(l.colourwayId);
      const ordered = l.quantity.toString();
      const received = l.receivedQty.toString();
      return {
        id: l.id,
        colourwayId: l.colourwayId,
        colourwayCode: cw?.code ?? l.colourwayId.slice(0, 8),
        colourName: cw?.colourName ?? "—",
        designCode: cw?.design.code ?? "—",
        unit: l.unit,
        orderedQty: ordered,
        receivedQty: received,
        pendingQty: subDec(ordered, received),
        rate: l.rate,
      };
    }),
    grns: row.grns.map((g) => ({
      id: g.id, number: g.number, receivedAt: g.receivedAt,
      invoiceRef: g.invoiceRef, lineCount: g._count.lines,
    })),
  };
}

// ── Colourway picker (for PO builder) ─────────────────────────────────────────

export async function listColourwaysForPO(ctx: RequestContext) {
  requirePermission(ctx, "po.create");
  const db = scoped(ctx);
  return db.colourway.findMany({
    where: { organizationId: ctx.orgId, isActive: true },
    orderBy: { code: "asc" },
    take: 500,
    select: {
      id: true, code: true, colourName: true, sellUnit: true,
      design: { select: { code: true, family: true } },
    },
  });
}

export type ColourwayPickerRow = Awaited<ReturnType<typeof listColourwaysForPO>>[0];

// ── PO KPIs ───────────────────────────────────────────────────────────────────

export interface POKPIs {
  openCount: number;
  outstandingValue: bigint;
  overdueCount: number;
}

export async function getPOKPIs(ctx: RequestContext): Promise<POKPIs> {
  requirePermission(ctx, "po.view");
  const db = scoped(ctx);

  const now = new Date();

  const [openRows, overdueCount] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { status: { in: ["DRAFT", "SENT", "PARTIAL"] as POStatus[] } },
      select: { totalValue: true },
    }),
    db.purchaseOrder.count({
      where: {
        status: { in: ["SENT", "PARTIAL"] as POStatus[] },
        expectedAt: { lt: now },
      },
    }),
  ]);

  const outstandingValue = openRows.reduce((s, r) => s + r.totalValue, 0n);
  return { openCount: openRows.length, outstandingValue, overdueCount };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function subDec(a: string, b: string): string {
  const scale = 10_000;
  const ai = Math.round(parseFloat(a) * scale);
  const bi = Math.round(parseFloat(b) * scale);
  const diff = ai - bi;
  const whole = Math.trunc(diff / scale);
  const frac = Math.abs(diff % scale).toString().padStart(4, "0").replace(/0+$/, "");
  return frac.length === 0 ? String(whole) : `${whole}.${frac}`;
}
