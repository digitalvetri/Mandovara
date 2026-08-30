// Product-family names in the owner's words.
//
// Split out of ItemCard on 2026-08-30 for CLAUDE.md §10's line ceiling.
// Mirrors FAMILY_LABEL in modules/measurement/simple-families.ts,
// widened to cover every family the detailed panel can still set.

export function familyLabel(family: string): string {
  const map: Record<string, string> = {
    CURTAIN_FABRIC: "Curtain",
    SHEER:          "Sheer",
    BLIND:          "Blind",
    WALLPAPER:      "Wallpaper",
    FLOORING:       "Flooring",
    CARPET_ROLL:    "Carpet",
    CARPET_TILE:    "Carpet tile",
    RUG:            "Rug",
    MURAL:          "Mural",
    SERVICE:        "Other / service",
  };
  return map[family] ?? family.replace(/_/g, " ").toLowerCase();
}
