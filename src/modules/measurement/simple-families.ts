// The product types the simple measurement form offers.
//
// Kept out of actions-simple.ts because a "use server" module may only
// export async functions — the form needs this list at render time.
//
// Deliberately short. This is a picker used standing in a client's
// living room, not the full ProductFamily enum; the detailed entry panel
// and the quotation stage still reach every family.

export const SIMPLE_FAMILIES = [
  "CURTAIN_FABRIC", "SHEER", "BLIND", "WALLPAPER",
  "FLOORING", "CARPET_ROLL", "MURAL", "SERVICE",
] as const;

export type SimpleFamily = (typeof SIMPLE_FAMILIES)[number];

/** What an owner calls these, rather than what the database does. */
export const FAMILY_LABEL: Record<SimpleFamily, string> = {
  CURTAIN_FABRIC: "Curtain",
  SHEER:          "Sheer",
  BLIND:          "Blind",
  WALLPAPER:      "Wallpaper",
  FLOORING:       "Flooring",
  CARPET_ROLL:    "Carpet",
  MURAL:          "Mural",
  SERVICE:        "Other / service",
};
