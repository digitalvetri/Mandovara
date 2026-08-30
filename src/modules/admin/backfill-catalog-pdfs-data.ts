// Static mapping of Drive filenames → on-disk slug → display name for the
// Platinum Range and Ready Stock brands. Extracted from backfill-catalog-pdfs.ts
// to keep that "use server" file under the 300-line lint cap.

// [ Drive filename (informational), disk slug, display collection name ]
export type BackfillEntry = readonly [origFilename: string, slug: string, collectionName: string];

export const BRAND_ENTRIES: Record<string, readonly BackfillEntry[]> = {
  "Platinum Range": [
    ["AFFINITY-CJS.pdf",                            "affinity.pdf",                          "Affinity"],
    ["ARCADIA CATALOUGE GRANDECO BELGIUM.pdf",      "arcadia-catalouge-grandeco-belgium.pdf","Arcadia Grandeco Belgium"],
    ["Asperia - CJS.pdf",                           "asperia.pdf",                           "Asperia"],
    ["CARMEN2.0-CJS.pdf",                           "carmen2-0.pdf",                         "Carmen 2.0"],
    ["CIARA-CJS.pdf",                               "ciara.pdf",                             "Ciara"],
    ["DREAM LAND-CJS.pdf",                          "dream-land.pdf",                        "Dream Land"],
    ["ENRICH-CJS.pdf",                              "enrich.pdf",                            "Enrich"],
    ["ESSENTIAL STRIPES-CJS.pdf",                   "essential-stripes.pdf",                 "Essential Stripes"],
    ["ESSENTIALS-CJS.pdf",                          "essentials.pdf",                        "Essentials"],
    ["FACADE-CJS.pdf",                              "facade.pdf",                            "Facade"],
    ["INIA GRANDECO.pdf",                           "inia-grandeco.pdf",                     "Inia Grandeco"],
    ["KARUNA - CJS.pdf",                            "karuna.pdf",                            "Karuna"],
    ["Kharma-CJS.pdf",                              "kharma.pdf",                            "Kharma"],
    ["LUCIDO-CJS.pdf",                              "lucido.pdf",                            "Lucido"],
    ["MIRAGE VI-CJS.pdf",                           "mirage-vi.pdf",                         "Mirage VI"],
    ["MIRAGE VII-CJS.pdf",                          "mirage-vii.pdf",                        "Mirage VII"],
    ["MIRAGE VIII.pdf",                             "mirage-viii.pdf",                       "Mirage VIII"],
    ["NOTABENE-CJS.pdf",                            "notabene.pdf",                          "Notabene"],
    ["ONYX-CJS.pdf",                                "onyx.pdf",                              "Onyx"],
    ["ORIGINS-CJS.pdf",                             "origins.pdf",                           "Origins"],
    ["OROM 2 - CJS.pdf",                            "orom-2.pdf",                            "Orom 2"],
    ["PIPPO KIDS-CJS.pdf",                          "pippo-kids.pdf",                        "Pippo Kids"],
    ["Reflect-CJS.pdf",                             "reflect.pdf",                           "Reflect"],
    ["ROMANCE MASUREEL -CJS.pdf",                   "romance-masureel.pdf",                  "Romance Masureel"],
    ["SILVER MOON XVII -CJS.pdf",                   "silver-moon-xvii-pdf.pdf",              "Silver Moon XVII"],
    ["SILVER MOON XVIII-1.pdf",                     "silver-moon-xviii-1.pdf",               "Silver Moon XVIII"],
    ["Small Prints.pdf",                            "small-prints.pdf",                      "Small Prints"],
    ["Soleado -CJS.pdf",                            "soleado.pdf",                           "Soleado"],
    ["TEXTURED VIBE-CJS.pdf",                       "textured-vibe.pdf",                     "Textured Vibe"],
    ["XTREME - CJS.pdf",                            "xtreme.pdf",                            "Xtreme"],
  ],
  "Ready Stock": [
    ["ATHENA - CJS.pdf",                            "athena.pdf",                            "Athena"],
    ["BrahMos-CJS.pdf",                             "brahmos.pdf",                           "BrahMos"],
    ["CASA - CJS.pdf",                              "casa.pdf",                              "Casa"],
    ["FLAMES- CJS.pdf",                             "flames.pdf",                            "Flames"],
    ["HAPPY.pdf",                                   "happy.pdf",                             "Happy"],
    ["LAVISH.pdf",                                  "lavish.pdf",                            "Lavish"],
    ["MACAU-CJS.pdf",                               "macau.pdf",                             "Macau"],
    ["NIHU2.pdf",                                   "nihu2.pdf",                             "Nihu 2"],
    ["SKY 1-CJS.pdf",                               "sky-1.pdf",                             "Sky 1"],
    ["SKY 2-CJS.pdf",                               "sky-2.pdf",                             "Sky 2"],
    ["VIBE - CJS.pdf",                              "vibe.pdf",                              "Vibe"],
  ],
};

export const UPLOADABLE_SLUGS = new Set(
  Object.values(BRAND_ENTRIES).flat().map(([, slug]) => slug),
);
