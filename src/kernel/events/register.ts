// One-shot registration for every domain-event listener in the app.
// Side-effect imported from `src/kernel/db/client.ts` so it runs once
// per process boot, before any query fires.
//
// Add new listener modules here. Each module's register function must be
// idempotent (safe to call twice — the modules themselves guard with a
// module-scoped `registered` flag).

import { registerMilestoneListeners } from "@/kernel/milestones/listeners";

let bootstrapped = false;

export function bootstrapEventListeners(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  registerMilestoneListeners();
}

// Auto-run on first import. Import order: prisma client → this module →
// listener modules → bus.subscribe.
bootstrapEventListeners();
