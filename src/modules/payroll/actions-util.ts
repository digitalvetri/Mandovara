// Sync helpers moved out of actions.ts: a "use server" file may only
// export async functions.

import { z } from "zod";

export const approveSchema = z.object({
  runId: z.string().min(1),
});
