// The child-row removal a project delete performs, as one function.
//
// Extracted from actions-delete.ts for two reasons. It cannot live in
// that file because "use server" modules may only export async
// functions taking serialisable arguments, and this one takes a Prisma
// transaction client. And the ordering below is the part most likely to
// break — Postgres has no cascade on most of these relations, so a
// mis-ordered statement is a foreign-key error at runtime and nothing
// else would catch it. Keeping it here lets a database-backed test run
// the real thing rather than a re-typed copy of it.
//
// See actions-delete.ts for what blocks a delete outright; by the time
// this runs, the project is known to carry no invoice, receipt,
// payment, advance, order, purchase order, stock movement, production
// job, architect commission or approved expense.

import type { TxClient } from "@/kernel/db/transaction";

export async function deleteProjectChildren(
  tx: TxClient,
  projectId: string,
): Promise<void> {
  // Measurements → items → CalcResult. CalcResult cascades off the item
  // (migration f66ef8b), so removing items is enough. Items are reached
  // through BOTH their measurement and their room: a room can hold an
  // item belonging to a round that was already superseded.
  const measurementIds = (
    await tx.measurement.findMany({ where: { projectId }, select: { id: true } })
  ).map((m) => m.id);
  const roomIds = (
    await tx.room.findMany({ where: { projectId }, select: { id: true } })
  ).map((r) => r.id);

  if (measurementIds.length > 0 || roomIds.length > 0) {
    await tx.measurementItem.deleteMany({
      where: {
        OR: [
          ...(measurementIds.length ? [{ measurementId: { in: measurementIds } }] : []),
          ...(roomIds.length         ? [{ roomId:        { in: roomIds } }]        : []),
        ],
      },
    });
  }
  await tx.measurement.deleteMany({ where: { projectId } });
  await tx.room.deleteMany({ where: { projectId } });

  // Quotations. Quotation_projectId_fkey is ON DELETE SET NULL, so
  // Postgres would happily detach every one of these and leave them
  // behind — a draft quote belonging to no project, in a list nobody
  // can filter it out of. Only the lead-origin ones are worth keeping
  // (they are that lead's history, and leadId XOR clientId means they
  // never carried a client anyway); the rest go with the project,
  // lines first. Quotation.parentId carries no foreign key, so a
  // revision chain needs no ordering of its own. Nothing ACCEPTED can
  // reach here — actions-delete.ts refuses that outright.
  await tx.quotation.updateMany({
    where: { projectId, leadId: { not: null } },
    data:  { projectId: null },
  });
  const quotationIds = (
    await tx.quotation.findMany({ where: { projectId }, select: { id: true } })
  ).map((q) => q.id);
  if (quotationIds.length > 0) {
    await tx.quotationLine.deleteMany({ where: { quotationId: { in: quotationIds } } });
    await tx.quotation.deleteMany({ where: { id: { in: quotationIds } } });
  }

  await tx.projectExpense.deleteMany({ where: { projectId } });
  await tx.projectDocument.deleteMany({ where: { projectId } });
  await tx.milestone.deleteMany({ where: { projectId } });
  await tx.siteLog.deleteMany({ where: { projectId } });
  await tx.siteVisit.deleteMany({ where: { projectId } });
  await tx.projectMember.deleteMany({ where: { projectId } });
  await tx.task.deleteMany({ where: { projectId } });

  // No foreign key on any of these, and none of them belong to the
  // project — they belong to an employee, a client or a conversation
  // that merely referenced it. Detach rather than delete, or a project
  // delete would silently eat attendance history and WhatsApp threads.
  await tx.attendance.updateMany({ where: { projectId }, data: { projectId: null } });
  await tx.document.updateMany({ where: { projectId }, data: { projectId: null } });
  await tx.chatChannel.updateMany({ where: { projectId }, data: { projectId: null } });
  await tx.communicationLog.updateMany({ where: { projectId }, data: { projectId: null } });
  await tx.whatsAppConversation.updateMany({ where: { projectId }, data: { projectId: null } });
}
