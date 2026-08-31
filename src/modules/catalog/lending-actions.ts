"use server";

// Issue and return a catalogue.
//
// Writes to SampleBook + SampleIssue, the ledger /samples already owns. The
// catalogue-backed SampleBook is created on first issue rather than seeded
// for all 694 — most catalogues never leave the shelf, and a table of
// placeholder books would be noise in the sample library.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

export interface IssueCatalogueInput {
  catalogueId: string;
  /** Free-text name. Required — it is what the shelf list prints. */
  holderName:  string;
  holderType:  "CLIENT" | "ARCHITECT" | "STAFF" | "OTHER";
  clientId?:   string;
  /** yyyy-mm-dd. Omitted when no return date was agreed. */
  dueAt?:      string;
  notes?:      string;
}

export async function issueCatalogue(input: IssueCatalogueInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  try {
    requirePermission(ctx, "catalog.update");
  } catch {
    return { ok: false, error: "You don't have permission to issue catalogues." };
  }

  const holderName = input.holderName.trim();
  if (!holderName) return { ok: false, error: "Enter who is taking it." };

  const db = scoped(ctx);
  const catalogue = await db.catalogue.findUnique({
    where:  { id: input.catalogueId },
    select: { id: true, name: true },
  });
  if (!catalogue) return { ok: false, error: "That catalogue no longer exists." };

  // Refuse a second open loan. The list would have to pick one to display,
  // and "who has it" would stop having a single answer.
  const alreadyOut = await db.sampleIssue.findFirst({
    where:  { returnedAt: null, book: { catalogueId: catalogue.id } },
    select: { id: true, holderName: true },
  });
  if (alreadyOut) {
    return {
      ok: false,
      error: `${catalogue.name} is already out${alreadyOut.holderName ? ` with ${alreadyOut.holderName}` : ""}. Mark it returned first.`,
    };
  }

  let dueAt: Date | undefined;
  if (input.dueAt) {
    const d = new Date(input.dueAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "That return date isn't valid." };
    dueAt = d;
  }

  try {
    const issue = await withTransaction(async (tx: TxClient) => {
      // Lazily create the lendable book for this catalogue.
      let book = await tx.sampleBook.findUnique({
        where:  { catalogueId: catalogue.id },
        select: { id: true },
      });
      if (!book) {
        book = await tx.sampleBook.create({
          data: {
            organizationId: ctx.orgId,
            catalogueId:    catalogue.id,
            // Barcode is required and unique per org. A catalogue has no
            // printed code, so derive a stable one from its id.
            barcode:        `CAT-${catalogue.id.slice(-10).toUpperCase()}`,
            status:         "IN_LIBRARY",
          },
          select: { id: true },
        });
      }

      const created = await tx.sampleIssue.create({
        data: {
          organizationId: ctx.orgId,
          sampleBookId:   book.id,
          issuedToType:   input.holderType,
          holderName,
          ...(input.clientId ? { clientId: input.clientId } : {}),
          ...(dueAt ? { dueAt } : {}),
          ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        },
        select: { id: true },
      });

      await tx.sampleBook.update({ where: { id: book.id }, data: { status: "ISSUED" } });
      return created;
    }, { orgId: ctx.orgId });

    revalidatePath("/catalogues");
    revalidatePath("/samples");
    return { ok: true, data: { id: issue.id } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? `Could not issue that catalogue: ${e.message}` : "Could not issue that catalogue.",
    };
  }
}

export async function returnCatalogue(catalogueId: string): Promise<ActionResult> {
  const ctx = await devContext();
  try {
    requirePermission(ctx, "catalog.update");
  } catch {
    return { ok: false, error: "You don't have permission to take catalogues back in." };
  }

  const db = scoped(ctx);
  const open = await db.sampleIssue.findFirst({
    where:  { returnedAt: null, book: { catalogueId } },
    select: { id: true, sampleBookId: true },
  });
  if (!open) return { ok: false, error: "That catalogue is already on the shelf." };

  try {
    await withTransaction(async (tx: TxClient) => {
      await tx.sampleIssue.update({
        where: { id: open.id },
        data:  { returnedAt: new Date() },
      });
      await tx.sampleBook.update({
        where: { id: open.sampleBookId },
        data:  { status: "IN_LIBRARY" },
      });
    }, { orgId: ctx.orgId });

    revalidatePath("/catalogues");
    revalidatePath("/samples");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? `Could not mark it returned: ${e.message}` : "Could not mark it returned.",
    };
  }
}
