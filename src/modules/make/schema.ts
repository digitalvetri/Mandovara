// Zod schemas for the make module.
//
// Deliberately small in 5a: the only writable surface is
// createMakeJobFromOrder({ orderId }). Kanban status transitions +
// material issue land in 5b and add more schemas here then.

import { z } from "zod";

export const createMakeJobFromOrderSchema = z.object({
  orderId: z.string().cuid("orderId must be a cuid"),
});

export type CreateMakeJobFromOrderInput =
  z.infer<typeof createMakeJobFromOrderSchema>;
