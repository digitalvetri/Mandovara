// Branch lookup — for dropdowns in forms across modules.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export interface BranchOption {
  id: string;
  name: string;
}

export async function listBranches(ctx: RequestContext): Promise<BranchOption[]> {
  const db = scoped(ctx);
  return db.branch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
