"use server";

// Writing a decade of books into the system.
//
// Partial success by design, matching the catalog importer: valid rows
// are committed even when others fail. A migration that refuses
// everything because forty rows out of a thousand are messy is a
// migration nobody completes — they need the 960 in, and a list of the
// 40 to fix and re-upload.
//
// Idempotent on the client's mobile, which is the identity this system
// matches on. Re-uploading a corrected file updates the clients that
// already came in rather than creating a second copy of each — because
// people WILL upload twice, and duplicate clients split a customer's
// projects between two records.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { parseMigrationWorkbook } from "./import-parser";
import type { ImportError } from "./import-types";
import type { ActionResult } from "./actions";

export interface MigrationResult {
  clientsCreated: number;
  clientsUpdated: number;
  projectsCreated: number;
  /** Projects whose client_code / mobile matched nothing in the file or the DB. */
  projectsOrphaned: number;
  errors: ImportError[];
}

export async function importClientsAndProjects(
  formData: FormData,
): Promise<ActionResult<MigrationResult>> {
  const ctx = await devContext();
  // Deliberately gated on client.create rather than a bespoke permission:
  // this creates clients, and anyone trusted to do that one at a time is
  // trusted to do it in bulk.
  requirePermission(ctx, "client.create");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Choose a file to import." };
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    return { ok: false, error: "The file must be an Excel workbook (.xlsx or .xls)." };
  }

  const parsed = parseMigrationWorkbook(Buffer.from(await file.arrayBuffer()));
  const errors = [...parsed.errors];

  const db = scoped(ctx);
  const branch = await db.branch.findFirst({ select: { id: true, invoicePrefix: true } });
  if (!branch) {
    return { ok: false, error: "No branch is configured — add one in Admin before importing." };
  }

  // ── Clients ────────────────────────────────────────────────────────
  const existing = await db.client.findMany({ select: { id: true, mobile: true, code: true } });
  const idByMobile = new Map(existing.map((c) => [c.mobile, c.id] as const));
  const idByCode   = new Map(existing.filter((c) => c.code).map((c) => [c.code, c.id] as const));

  let clientsCreated = 0;
  let clientsUpdated = 0;
  const yymm = yymmFromDate(new Date());

  for (const row of parsed.clients) {
    const billingAddress = {
      ...(row.addressLine && { line1: row.addressLine }),
      ...(row.city    && { city: row.city }),
      ...(row.state   && { state: row.state }),
      ...(row.pincode && { pincode: row.pincode }),
    };
    try {
      const found = idByMobile.get(row.mobile);
      if (found) {
        await db.client.update({
          where: { id: found },
          data: {
            name: row.name, type: row.type,
            ...(row.email && { email: row.email }),
            ...(row.gstin && { gstin: row.gstin }),
            ...(row.notes && { notes: row.notes }),
            ...(Object.keys(billingAddress).length > 0 && { billingAddress }),
          },
        });
        clientsUpdated += 1;
        continue;
      }

      const created = await withTransaction(async (tx: TxClient) => {
        // Keep their own code when the file carries one — staff recognise
        // it, and it is how the Projects sheet refers back here.
        const code = row.code && !idByCode.has(row.code)
          ? row.code
          : await allocateNumber(tx, { orgId: ctx.orgId, series: "CLI", yymm, prefix: "MDV" });
        return tx.client.create({
          data: {
            organizationId: ctx.orgId,
            code, name: row.name, mobile: row.mobile, type: row.type,
            email: row.email ?? undefined,
            gstin: row.gstin ?? undefined,
            notes: row.notes ?? undefined,
            billingAddress,
            ownerId: ctx.userId,
          },
          select: { id: true, code: true },
        });
      }, { orgId: ctx.orgId });

      idByMobile.set(row.mobile, created.id);
      if (created.code) idByCode.set(created.code, created.id);
      if (row.code) idByCode.set(row.code, created.id);
      clientsCreated += 1;
    } catch (e) {
      errors.push({
        sheet: "Clients", row: row.rowNumber, field: "-",
        reason: e instanceof Error ? e.message : "Could not save this client.",
      });
    }
  }

  // ── Projects ───────────────────────────────────────────────────────
  let projectsCreated = 0;
  let projectsOrphaned = 0;

  for (const row of parsed.projects) {
    // The reference may be a code or a mobile — try both before giving up.
    const clientId =
      idByCode.get(row.clientRef) ??
      idByMobile.get(row.clientRef) ??
      (() => {
        const m = row.clientRef.replace(/\D+/g, "");
        return m.length >= 10 ? idByMobile.get(`+91${m.slice(-10)}`) : undefined;
      })();

    if (!clientId) {
      projectsOrphaned += 1;
      errors.push({
        sheet: "Projects", row: row.rowNumber, field: "client_code",
        reason: `No client matches "${row.clientRef}". Add them to the Clients sheet, or correct the reference.`,
      });
      continue;
    }

    try {
      await withTransaction(async (tx: TxClient) => {
        const number = await allocateNumber(tx, {
          orgId: ctx.orgId, series: "PRJ",
          yymm: yymmFromDate(row.startedOn ?? new Date()),
          prefix: branch.invoicePrefix,
        });
        await tx.project.create({
          data: {
            organizationId: ctx.orgId,
            branchId: branch.id,
            number,
            name: row.name,
            clientId,
            stage: row.stage as never,
            orderValue: row.orderValuePaise,
            ownerId: ctx.userId,
            // Soft intake fields live in siteAddress JSON, matching how
            // convertLead stores them — never overload orderValue.
            siteAddress: {
              ...(row.siteAddress && { line1: row.siteAddress }),
              ...(row.siteCity && { city: row.siteCity }),
              ...(row.notes && { requirement: row.notes }),
              importedAt: new Date().toISOString(),
            },
            ...(row.startedOn && { createdAt: row.startedOn }),
          },
        });
      }, { orgId: ctx.orgId });
      projectsCreated += 1;
    } catch (e) {
      errors.push({
        sheet: "Projects", row: row.rowNumber, field: "-",
        reason: e instanceof Error ? e.message : "Could not save this project.",
      });
    }
  }

  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/");
  return {
    ok: true,
    data: { clientsCreated, clientsUpdated, projectsCreated, projectsOrphaned, errors },
  };
}
