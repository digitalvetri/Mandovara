"use server";

// Read and change the bank details printed on quotations. Same pattern as
// audit-retention.ts: one Setting row per organisation, changed only with
// admin.settings.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { orgPrisma } from "@/kernel/db/rls";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { BANK_DETAILS_KEY, bankDetailsInput, readBankDetails, type BankDetails } from "./bank-details";
import type { ActionResult } from "./actions";

export async function getBankDetails(): Promise<BankDetails> {
  const ctx = await devContext();
  const row = await scoped(ctx).setting.findFirst({
    where:  { key: BANK_DETAILS_KEY },
    select: { value: true },
  });
  return readBankDetails(row?.value);
}

export async function setBankDetails(input: unknown): Promise<ActionResult<BankDetails>> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.settings");
  const parsed = bankDetailsInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the bank details" };
  }
  const value = { ...parsed.data };

  await orgPrisma(ctx.orgId).setting.upsert({
    where:  { organizationId_key: { organizationId: ctx.orgId, key: BANK_DETAILS_KEY } },
    create: { organizationId: ctx.orgId, key: BANK_DETAILS_KEY, value },
    update: { value },
  });

  revalidatePath("/admin");
  return { ok: true, data: value };
}
