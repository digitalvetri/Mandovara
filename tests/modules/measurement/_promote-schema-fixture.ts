// Re-export the promote-schema for the test. Kept out of the main
// action file so we can import it into the test without pulling the
// entire `"use server"` module chain (which would need next/cache).

import { z } from "zod";
import { addItemSchema } from "../../../src/modules/measurement/schema";

export const promoteSchema = z.object({
  payload: addItemSchema,
  reason:  z.string().trim().min(5).max(500),
});
