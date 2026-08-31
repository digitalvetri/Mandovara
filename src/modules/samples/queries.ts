// Sample Library repository.
// Schema: SampleBook (id, barcode, costValue, status SampleStatus, collectionId)
//         SampleIssue (sampleBookId, issuedToType, clientId?, architectId?, userId?,
//                      issuedAt, dueAt, returnedAt?)
// SampleStatus enum: IN_LIBRARY ISSUED OVERDUE RETURNED LOST

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface SampleBookRow {
  id: string;
  barcode: string;
  collectionName: string;
  brandName: string;
  costValue: bigint;
  status: string;
  // Current holder (from most recent un-returned SampleIssue)
  holderType: string | null;
  holderName: string | null;
  issuedAt: Date | null;
  dueAt: Date | null;
  daysOverdue: number | null;  // positive = overdue, null = not issued
}

export interface ListSampleBooksResult {
  rows: SampleBookRow[];
  overdueCount: number;
  issuedCount: number;
  inLibraryCount: number;
}

export async function listSampleBooks(
  ctx: RequestContext,
  opts: { status?: string } = {},
): Promise<ListSampleBooksResult> {
  requirePermission(ctx, "catalog.view");
  const db = scoped(ctx);
  const now = new Date();

  const whereStatus = opts.status && opts.status !== "ALL"
    ? { status: opts.status as "IN_LIBRARY" | "ISSUED" | "OVERDUE" | "RETURNED" | "LOST" }
    : {};

  const [books, overdueCount, issuedCount, inLibraryCount] = await Promise.all([
    db.sampleBook.findMany({
      where: whereStatus,
      orderBy: { barcode: "asc" },
      take: 200,
      select: {
        id: true,
        barcode: true,
        costValue: true,
        status: true,
        collection: {
          select: {
            name: true,
            brand: { select: { name: true } },
          },
        },
        catalogue: { select: { name: true } },
        issues: {
          where: { returnedAt: null },
          orderBy: { issuedAt: "desc" },
          take: 1,
          select: {
            issuedToType: true,
            clientId: true,
            architectId: true,
            userId: true,
            holderName: true,
            issuedAt: true,
            dueAt: true,
          },
        },
      },
    }),
    db.sampleBook.count({ where: { status: "OVERDUE" } }),
    db.sampleBook.count({ where: { status: "ISSUED" } }),
    db.sampleBook.count({ where: { status: "IN_LIBRARY" } }),
  ]);

  // Batch-resolve holder names
  const clientIds = [...new Set(
    books.flatMap((b) => b.issues.flatMap((i) => i.clientId ? [i.clientId] : [])),
  )];
  const architectIds = [...new Set(
    books.flatMap((b) => b.issues.flatMap((i) => i.architectId ? [i.architectId] : [])),
  )];
  const userIds = [...new Set(
    books.flatMap((b) => b.issues.flatMap((i) => i.userId ? [i.userId] : [])),
  )];

  const [clients, architects, users] = await Promise.all([
    clientIds.length > 0
      ? db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : [],
    architectIds.length > 0
      ? db.architect.findMany({ where: { id: { in: architectIds } }, select: { id: true, contactName: true } })
      : [],
    userIds.length > 0
      ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [],
  ]);

  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const archName = new Map(architects.map((a) => [a.id, a.contactName]));
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const rows: SampleBookRow[] = books.map((b) => {
    const issue = b.issues[0] ?? null;
    let holderType: string | null = null;
    let holderName: string | null = null;
    let daysOverdue: number | null = null;

    if (issue) {
      holderType = issue.issuedToType;
      if (issue.clientId)    holderName = clientName.get(issue.clientId) ?? null;
      if (issue.architectId) holderName = archName.get(issue.architectId) ?? null;
      if (issue.userId)      holderName = userName.get(issue.userId) ?? null;

      // A loan with no agreed return date cannot be overdue — a catalogue
      // handed to a walk-in usually has none.
      if (issue.dueAt) {
        const dueMs = now.getTime() - issue.dueAt.getTime();
        if (dueMs > 0) daysOverdue = Math.ceil(dueMs / 86_400_000);
      }
      // Falls back to the snapshot for a holder whose record has gone.
      holderName ??= issue.holderName ?? null;
    }

    return {
      id: b.id,
      barcode: b.barcode,
      collectionName: b.collection?.name ?? b.catalogue?.name ?? "—",
      brandName: b.collection?.brand.name ?? (b.catalogue ? "Studio catalogue" : "—"),
      costValue: b.costValue,
      status: b.status,
      holderType,
      holderName,
      issuedAt: issue?.issuedAt ?? null,
      dueAt: issue?.dueAt ?? null,
      daysOverdue,
    };
  });

  return { rows, overdueCount, issuedCount, inLibraryCount };
}
