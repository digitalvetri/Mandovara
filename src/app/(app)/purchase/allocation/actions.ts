"use server";

// Thin server action so the console can read the shelf for one colourway
// without shipping every lot in the warehouse to the browser.

import { devContext } from "@/lib/dev-context";
import { listAvailableLotsForProduct, type AvailableLotRow } from "@/modules/allocation/queries";

export async function lotsForColourway(
  colourwayId: string,
): Promise<{ ok: boolean; data?: AvailableLotRow[]; error?: string }> {
  try {
    const ctx = await devContext();
    return { ok: true, data: await listAvailableLotsForProduct(ctx, colourwayId) };
  } catch (e) {
    console.error("[allocation] lotsForColourway failed:", e);
    return { ok: false, error: "Could not read stock lots." };
  }
}
