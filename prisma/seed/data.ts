// Mandovara Interior OS — reference data for seed.
// All construction-industry data replaced with furnishing/décor domain.

export const STATE_CODES = {
  TN: "33", // Tamil Nadu — home state (intra-state → CGST + SGST)
  KL: "32", // Kerala      — inter-state → IGST
  KA: "29", // Karnataka   — inter-state → IGST
  AP: "28", // Andhra Pradesh
  MH: "27", // Maharashtra
} as const;

export const TN_CITIES = [
  "Coimbatore", "Coimbatore", "Coimbatore", "Coimbatore", // weighted
  "Coimbatore", "Coimbatore",
  "Chennai", "Madurai", "Salem", "Erode", "Tiruppur",
  "Trichy", "Vellore", "Tirunelveli", "Karur",
];
export const KL_CITIES = ["Kochi", "Trivandrum", "Kozhikode", "Thrissur", "Palakkad"];
export const KA_CITIES = ["Bengaluru", "Mysuru", "Mangaluru", "Hubli", "Bellary"];

export const FIRST_NAMES_TN = [
  "Anbu", "Selvi", "Karthik", "Meena", "Ravi", "Priya", "Suresh", "Deepa",
  "Vignesh", "Divya", "Bala", "Kavitha", "Prakash", "Anitha", "Manoj", "Latha",
  "Senthil", "Geetha", "Murugan", "Santha", "Vijay", "Radha", "Krishnan", "Uma",
  "Durai", "Vasantha", "Thiru", "Malathi", "Arjun", "Nila",
];

export const LAST_NAMES_TN = [
  "Kumar", "Raj", "Murugan", "Krishnan", "Subramaniam", "Iyer", "Venkatesh",
  "Rajesh", "Prasad", "Natarajan", "Shankar", "Bose", "Pillai", "Nadar",
  "Gounder", "Pandian", "Chettiar", "Rajan", "Selvam", "Arumugam",
];

export const ARCHITECT_FIRMS = [
  "Artisan Spaces", "Studio Horizon", "Design Collective", "Innova Architects",
  "Prism Design Studio", "Vertex Interiors", "Skyline Concepts", "Bloom Design",
  "Zenith Architects", "Fusion Space", "Element Studio", "Forma Interiors",
  "Casa Studio", "Aria Design", "Nook & Cranny", "Spectrum Interiors",
  "Vibe Architects", "Grid Design", "Palette Studio", "Cube Concepts",
];

// Coimbatore localities for site addresses
export const CBE_LOCALITIES = [
  "RS Puram", "Peelamedu", "Saibaba Colony", "Gandhipuram", "Singanallur",
  "Thadagam Road", "Race Course", "Vadavalli", "Kovaipudur", "Avinashi Road",
  "Sundarapuram", "Palladam", "Podanur", "Vilankurichi", "Sowripalayam",
  "Kovilpalayam", "Kalapatti", "Saravanampatty", "Thudiyalur", "Ondipudur",
];

// 22 brands across 9 product families — realistic for a Coimbatore interiors house
export interface BrandSpec {
  name: string;
  country: string;
  leadTimeDays: number;
  families: string[];      // ProductFamily enum values this brand covers
  collections: CollectionSpec[];
}

export interface CollectionSpec {
  name: string;
  family: string;          // ProductFamily
  seasonYear?: number;
  designCount: number;
  designTemplate: DesignTemplate;
}

export interface DesignTemplate {
  rollWidthMm?: number;
  rollLengthM?: number;
  fabricWidthMm?: number;
  patternRepeats?: number[];     // choices for patternRepeatMm
  patternMatches?: string[];     // PatternMatch choices
  railroadable?: boolean;
  areaPerBoxSqft?: number;
  tileSizeMm?: string;
  hsn: string;
  gstRate: number;
  sellUnit: string;              // SellUnit
  family: string;                // ProductFamily
  priceRangePaise: [number, number]; // [costMin, costMax] per unit
}

export const BRANDS: readonly BrandSpec[] = [
  // ── WALLPAPER (6 brands) ──────────────────────────────────────────────────
  {
    name: "Grandeco", country: "Belgium", leadTimeDays: 21,
    families: ["WALLPAPER"],
    collections: [
      {
        name: "Nordic Botanics", family: "WALLPAPER", seasonYear: 2025, designCount: 12,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 320, 640], patternMatches: ["FREE","STRAIGHT","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [280000, 560000] },
      },
      {
        name: "Velvet Luxe", family: "WALLPAPER", seasonYear: 2025, designCount: 10,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 530, 1060], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [420000, 840000] },
      },
      {
        name: "Urban Geometry", family: "WALLPAPER", seasonYear: 2024, designCount: 8,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 265], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [320000, 640000] },
      },
      {
        name: "Artisan Textures", family: "WALLPAPER", seasonYear: 2024, designCount: 9,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 640], patternMatches: ["FREE","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [350000, 700000] },
      },
      {
        name: "Serenity Plains", family: "WALLPAPER", seasonYear: 2024, designCount: 6,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0], patternMatches: ["FREE"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [240000, 480000] },
      },
    ],
  },
  {
    name: "Graham & Brown", country: "United Kingdom", leadTimeDays: 28,
    families: ["WALLPAPER"],
    collections: [
      {
        name: "Established 1946", family: "WALLPAPER", seasonYear: 2025, designCount: 11,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 530, 1060], patternMatches: ["FREE","STRAIGHT","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [380000, 760000] },
      },
      {
        name: "Superfresco Easy", family: "WALLPAPER", seasonYear: 2025, designCount: 10,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 320], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [290000, 580000] },
      },
      {
        name: "Tranquil Living", family: "WALLPAPER", seasonYear: 2024, designCount: 8,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 640], patternMatches: ["FREE","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [310000, 620000] },
      },
      {
        name: "Prestige", family: "WALLPAPER", seasonYear: 2024, designCount: 9,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 320, 640], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [450000, 900000] },
      },
      {
        name: "Essential Textures", family: "WALLPAPER", seasonYear: 2023, designCount: 7,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0], patternMatches: ["FREE"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [220000, 440000] },
      },
    ],
  },
  {
    name: "York Wallcoverings", country: "United States", leadTimeDays: 35,
    families: ["WALLPAPER"],
    collections: [
      {
        name: "Magnolia Home", family: "WALLPAPER", seasonYear: 2025, designCount: 10,
        designTemplate: { rollWidthMm: 530, rollLengthM: 9.75, patternRepeats: [0, 480, 960], patternMatches: ["FREE","STRAIGHT","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [480000, 960000] },
      },
      {
        name: "Rifle Paper Co", family: "WALLPAPER", seasonYear: 2025, designCount: 9,
        designTemplate: { rollWidthMm: 530, rollLengthM: 9.75, patternRepeats: [0, 530, 1060], patternMatches: ["FREE","STRAIGHT","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [540000, 1080000] },
      },
      {
        name: "Ronald Redding", family: "WALLPAPER", seasonYear: 2024, designCount: 8,
        designTemplate: { rollWidthMm: 530, rollLengthM: 9.75, patternRepeats: [0, 480], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [420000, 840000] },
      },
      {
        name: "Simply Candice", family: "WALLPAPER", seasonYear: 2024, designCount: 7,
        designTemplate: { rollWidthMm: 530, rollLengthM: 9.75, patternRepeats: [0, 320], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [360000, 720000] },
      },
      {
        name: "Missoni Home", family: "WALLPAPER", seasonYear: 2023, designCount: 6,
        designTemplate: { rollWidthMm: 530, rollLengthM: 9.75, patternRepeats: [0, 640, 1280], patternMatches: ["FREE","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [680000, 1360000] },
      },
    ],
  },
  {
    name: "Nilaya by Asian Paints", country: "India", leadTimeDays: 10,
    families: ["WALLPAPER"],
    collections: [
      {
        name: "Regal Florals", family: "WALLPAPER", seasonYear: 2025, designCount: 12,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 480, 960], patternMatches: ["FREE","STRAIGHT","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [180000, 360000] },
      },
      {
        name: "Heritage Prints", family: "WALLPAPER", seasonYear: 2025, designCount: 10,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 320, 640], patternMatches: ["FREE","STRAIGHT","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [200000, 400000] },
      },
      {
        name: "Contemporary Chic", family: "WALLPAPER", seasonYear: 2024, designCount: 9,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 265], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [160000, 320000] },
      },
      {
        name: "Monsoon Muse", family: "WALLPAPER", seasonYear: 2024, designCount: 8,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 640], patternMatches: ["FREE","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [170000, 340000] },
      },
      {
        name: "Minimal Moods", family: "WALLPAPER", seasonYear: 2023, designCount: 7,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0], patternMatches: ["FREE"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [150000, 300000] },
      },
    ],
  },
  {
    name: "Divine Décors", country: "India", leadTimeDays: 7,
    families: ["WALLPAPER"],
    collections: [
      {
        name: "Royal Damask", family: "WALLPAPER", seasonYear: 2025, designCount: 10,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 530, 1060], patternMatches: ["FREE","STRAIGHT","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [130000, 280000] },
      },
      {
        name: "Abstract Expressions", family: "WALLPAPER", seasonYear: 2025, designCount: 8,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 320], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [120000, 260000] },
      },
      {
        name: "Kids Wonderland", family: "WALLPAPER", seasonYear: 2024, designCount: 9,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 480], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [110000, 240000] },
      },
      {
        name: "Tropical Paradise", family: "WALLPAPER", seasonYear: 2024, designCount: 7,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 640, 1280], patternMatches: ["FREE","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [140000, 300000] },
      },
      {
        name: "Classic Plains", family: "WALLPAPER", seasonYear: 2023, designCount: 6,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0], patternMatches: ["FREE"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [100000, 220000] },
      },
    ],
  },
  {
    name: "Sonewall", country: "India", leadTimeDays: 5,
    families: ["WALLPAPER"],
    collections: [
      {
        name: "Stone & Concrete", family: "WALLPAPER", seasonYear: 2025, designCount: 9,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 265, 530], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [90000, 200000] },
      },
      {
        name: "Wood & Rattan", family: "WALLPAPER", seasonYear: 2025, designCount: 8,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 320, 640], patternMatches: ["FREE","STRAIGHT","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [95000, 210000] },
      },
      {
        name: "Metallic Moments", family: "WALLPAPER", seasonYear: 2024, designCount: 7,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0, 480], patternMatches: ["FREE","STRAIGHT"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [110000, 240000] },
      },
      {
        name: "Weave & Texture", family: "WALLPAPER", seasonYear: 2024, designCount: 6,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [0], patternMatches: ["FREE"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [80000, 180000] },
      },
    ],
  },

  // ── CURTAIN FABRICS (4 brands) ────────────────────────────────────────────
  {
    name: "Fibre Naturelle", country: "United Kingdom", leadTimeDays: 21,
    families: ["CURTAIN_FABRIC","SHEER","LINING"],
    collections: [
      {
        name: "Serene Silks Vol 3", family: "CURTAIN_FABRIC", seasonYear: 2025, designCount: 14,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0, 90, 180], patternMatches: ["FREE","STRAIGHT"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [80000, 280000] },
      },
      {
        name: "Velvet Dreams", family: "CURTAIN_FABRIC", seasonYear: 2025, designCount: 10,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0, 120], patternMatches: ["FREE","STRAIGHT"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [140000, 420000] },
      },
      {
        name: "Sheer Elegance", family: "SHEER", seasonYear: 2025, designCount: 12,
        designTemplate: { fabricWidthMm: 2800, patternRepeats: [0], patternMatches: ["FREE"], railroadable: true, hsn: "5407", gstRate: 5, sellUnit: "METRE", family: "SHEER", priceRangePaise: [30000, 90000] },
      },
      {
        name: "Classic Weaves", family: "CURTAIN_FABRIC", seasonYear: 2024, designCount: 11,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0, 90, 180, 360], patternMatches: ["FREE","STRAIGHT","OFFSET"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [70000, 200000] },
      },
      {
        name: "Blackout Collection", family: "LINING", seasonYear: 2024, designCount: 6,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0], patternMatches: ["FREE"], railroadable: false, hsn: "5407", gstRate: 5, sellUnit: "METRE", family: "LINING", priceRangePaise: [25000, 60000] },
      },
    ],
  },
  {
    name: "Rialto", country: "Italy", leadTimeDays: 28,
    families: ["CURTAIN_FABRIC","SHEER"],
    collections: [
      {
        name: "Milano Lusso", family: "CURTAIN_FABRIC", seasonYear: 2025, designCount: 10,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0, 180, 360], patternMatches: ["FREE","STRAIGHT"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [200000, 600000] },
      },
      {
        name: "Venezia Sheers", family: "SHEER", seasonYear: 2025, designCount: 8,
        designTemplate: { fabricWidthMm: 2800, patternRepeats: [0, 120], patternMatches: ["FREE","STRAIGHT"], railroadable: true, hsn: "5407", gstRate: 5, sellUnit: "METRE", family: "SHEER", priceRangePaise: [60000, 180000] },
      },
      {
        name: "Roma Textures", family: "CURTAIN_FABRIC", seasonYear: 2024, designCount: 9,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0, 90], patternMatches: ["FREE","STRAIGHT"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [180000, 480000] },
      },
      {
        name: "Toscana Plains", family: "CURTAIN_FABRIC", seasonYear: 2024, designCount: 8,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0], patternMatches: ["FREE"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [160000, 400000] },
      },
    ],
  },
  {
    name: "Miros Fabrics", country: "India", leadTimeDays: 10,
    families: ["CURTAIN_FABRIC","SHEER","LINING"],
    collections: [
      {
        name: "Premier Drapes", family: "CURTAIN_FABRIC", seasonYear: 2025, designCount: 13,
        designTemplate: { fabricWidthMm: 1100, patternRepeats: [0, 90, 180], patternMatches: ["FREE","STRAIGHT"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [50000, 160000] },
      },
      {
        name: "Light & Breezy", family: "SHEER", seasonYear: 2025, designCount: 10,
        designTemplate: { fabricWidthMm: 2800, patternRepeats: [0, 120], patternMatches: ["FREE","STRAIGHT"], railroadable: true, hsn: "5407", gstRate: 5, sellUnit: "METRE", family: "SHEER", priceRangePaise: [20000, 70000] },
      },
      {
        name: "Jacquard Royale", family: "CURTAIN_FABRIC", seasonYear: 2024, designCount: 11,
        designTemplate: { fabricWidthMm: 1100, patternRepeats: [0, 180, 360], patternMatches: ["FREE","STRAIGHT","OFFSET"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [70000, 200000] },
      },
      {
        name: "Budget Basics", family: "LINING", seasonYear: 2024, designCount: 5,
        designTemplate: { fabricWidthMm: 1100, patternRepeats: [0], patternMatches: ["FREE"], railroadable: false, hsn: "5407", gstRate: 5, sellUnit: "METRE", family: "LINING", priceRangePaise: [15000, 40000] },
      },
    ],
  },
  {
    name: "Casamance", country: "France", leadTimeDays: 35,
    families: ["CURTAIN_FABRIC","WALLPAPER"],
    collections: [
      {
        name: "Voyage Extraordinaire", family: "CURTAIN_FABRIC", seasonYear: 2025, designCount: 9,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0, 180, 360], patternMatches: ["FREE","STRAIGHT","OFFSET"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [280000, 840000] },
      },
      {
        name: "Jardin Secret", family: "CURTAIN_FABRIC", seasonYear: 2024, designCount: 8,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0, 240, 480], patternMatches: ["FREE","STRAIGHT","OFFSET"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [320000, 960000] },
      },
      {
        name: "French Prints", family: "WALLPAPER", seasonYear: 2025, designCount: 7,
        designTemplate: { rollWidthMm: 530, rollLengthM: 10.05, patternRepeats: [320, 640], patternMatches: ["STRAIGHT","OFFSET"], hsn: "4814", gstRate: 18, sellUnit: "ROLL", family: "WALLPAPER", priceRangePaise: [600000, 1200000] },
      },
      {
        name: "Pastel Elegance", family: "CURTAIN_FABRIC", seasonYear: 2023, designCount: 6,
        designTemplate: { fabricWidthMm: 1400, patternRepeats: [0], patternMatches: ["FREE"], railroadable: false, hsn: "5407", gstRate: 12, sellUnit: "METRE", family: "CURTAIN_FABRIC", priceRangePaise: [260000, 780000] },
      },
    ],
  },

  // ── BLINDS (3 brands) ─────────────────────────────────────────────────────
  {
    name: "Toso", country: "Italy", leadTimeDays: 21,
    families: ["BLIND"],
    collections: [
      {
        name: "Venezia Roller Collection", family: "BLIND", seasonYear: 2025, designCount: 10,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [7000, 18000] },
      },
      {
        name: "Romano Zebra", family: "BLIND", seasonYear: 2025, designCount: 9,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [8000, 22000] },
      },
      {
        name: "Milano Cellular", family: "BLIND", seasonYear: 2024, designCount: 8,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [10000, 28000] },
      },
      {
        name: "Woodline Wooden", family: "BLIND", seasonYear: 2024, designCount: 7,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [12000, 35000] },
      },
    ],
  },
  {
    name: "Rolluya", country: "Belgium", leadTimeDays: 14,
    families: ["BLIND"],
    collections: [
      {
        name: "SolarScreen Pro", family: "BLIND", seasonYear: 2025, designCount: 11,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [6000, 16000] },
      },
      {
        name: "Panel & Roman", family: "BLIND", seasonYear: 2025, designCount: 8,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [7000, 20000] },
      },
      {
        name: "PVC Shutters", family: "BLIND", seasonYear: 2024, designCount: 7,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [9000, 25000] },
      },
      {
        name: "Motorize Me", family: "BLIND", seasonYear: 2024, designCount: 6,
        designTemplate: { hsn: "6303", gstRate: 18, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [18000, 50000] },
      },
    ],
  },
  {
    name: "Verosol", country: "Netherlands", leadTimeDays: 28,
    families: ["BLIND"],
    collections: [
      {
        name: "Optix Blackout", family: "BLIND", seasonYear: 2025, designCount: 9,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [11000, 30000] },
      },
      {
        name: "SunProtect Outdoor", family: "BLIND", seasonYear: 2025, designCount: 7,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [15000, 42000] },
      },
      {
        name: "Daylight Filter", family: "BLIND", seasonYear: 2024, designCount: 8,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [9000, 26000] },
      },
      {
        name: "Skylight Systems", family: "BLIND", seasonYear: 2024, designCount: 5,
        designTemplate: { hsn: "6303", gstRate: 12, sellUnit: "SQFT", family: "BLIND", priceRangePaise: [20000, 60000] },
      },
    ],
  },

  // ── FLOORING (4 brands) ───────────────────────────────────────────────────
  {
    name: "Quick-Step", country: "Belgium", leadTimeDays: 21,
    families: ["FLOORING"],
    collections: [
      {
        name: "Impressive Series", family: "FLOORING", seasonYear: 2025, designCount: 12,
        designTemplate: { areaPerBoxSqft: 21.53, hsn: "4411", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [180000, 320000] },
      },
      {
        name: "Livyn Rigid Click", family: "FLOORING", seasonYear: 2025, designCount: 10,
        designTemplate: { areaPerBoxSqft: 18.29, hsn: "3918", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [220000, 380000] },
      },
      {
        name: "Eligna Premium", family: "FLOORING", seasonYear: 2024, designCount: 9,
        designTemplate: { areaPerBoxSqft: 21.53, hsn: "4411", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [160000, 290000] },
      },
      {
        name: "Creo Engineered", family: "FLOORING", seasonYear: 2024, designCount: 8,
        designTemplate: { areaPerBoxSqft: 14.40, hsn: "4411", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [280000, 500000] },
      },
    ],
  },
  {
    name: "Pergo", country: "Sweden", leadTimeDays: 21,
    families: ["FLOORING"],
    collections: [
      {
        name: "Original Excellence", family: "FLOORING", seasonYear: 2025, designCount: 11,
        designTemplate: { areaPerBoxSqft: 21.53, hsn: "4411", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [200000, 360000] },
      },
      {
        name: "Max Water Resistant", family: "FLOORING", seasonYear: 2025, designCount: 9,
        designTemplate: { areaPerBoxSqft: 18.29, hsn: "3918", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [240000, 420000] },
      },
      {
        name: "Sensation Master", family: "FLOORING", seasonYear: 2024, designCount: 8,
        designTemplate: { areaPerBoxSqft: 21.53, hsn: "4411", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [180000, 320000] },
      },
    ],
  },
  {
    name: "Gerflor", country: "France", leadTimeDays: 14,
    families: ["FLOORING"],
    collections: [
      {
        name: "Creation 55 Clic", family: "FLOORING", seasonYear: 2025, designCount: 13,
        designTemplate: { areaPerBoxSqft: 17.22, hsn: "3918", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [190000, 340000] },
      },
      {
        name: "Virtuo Premium", family: "FLOORING", seasonYear: 2025, designCount: 10,
        designTemplate: { areaPerBoxSqft: 17.22, hsn: "3918", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [230000, 410000] },
      },
      {
        name: "Senso Adjust", family: "FLOORING", seasonYear: 2024, designCount: 8,
        designTemplate: { areaPerBoxSqft: 21.53, hsn: "3918", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [140000, 260000] },
      },
    ],
  },
  {
    name: "Armstrong", country: "United States", leadTimeDays: 28,
    families: ["FLOORING"],
    collections: [
      {
        name: "Luxe Plank", family: "FLOORING", seasonYear: 2025, designCount: 10,
        designTemplate: { areaPerBoxSqft: 22.97, hsn: "3918", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [260000, 460000] },
      },
      {
        name: "Farm House Plank", family: "FLOORING", seasonYear: 2024, designCount: 9,
        designTemplate: { areaPerBoxSqft: 22.97, hsn: "4411", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [170000, 300000] },
      },
      {
        name: "Natural Creations", family: "FLOORING", seasonYear: 2024, designCount: 7,
        designTemplate: { areaPerBoxSqft: 18.29, hsn: "3918", gstRate: 18, sellUnit: "BOX", family: "FLOORING", priceRangePaise: [210000, 380000] },
      },
    ],
  },

  // ── CARPETS (2 brands) ────────────────────────────────────────────────────
  {
    name: "Cormar Carpets", country: "United Kingdom", leadTimeDays: 21,
    families: ["CARPET_ROLL"],
    collections: [
      {
        name: "Sensation Range", family: "CARPET_ROLL", seasonYear: 2025, designCount: 10,
        designTemplate: { rollWidthMm: 3660, hsn: "5703", gstRate: 5, sellUnit: "SQFT", family: "CARPET_ROLL", priceRangePaise: [5000, 15000] },
      },
      {
        name: "Primo Ultra", family: "CARPET_ROLL", seasonYear: 2024, designCount: 8,
        designTemplate: { rollWidthMm: 3660, hsn: "5703", gstRate: 5, sellUnit: "SQFT", family: "CARPET_ROLL", priceRangePaise: [7000, 20000] },
      },
      {
        name: "Natural Berber", family: "CARPET_ROLL", seasonYear: 2024, designCount: 7,
        designTemplate: { rollWidthMm: 4000, hsn: "5703", gstRate: 5, sellUnit: "SQFT", family: "CARPET_ROLL", priceRangePaise: [6000, 18000] },
      },
    ],
  },
  {
    name: "Interface Carpet Tiles", country: "United States", leadTimeDays: 21,
    families: ["CARPET_TILE"],
    collections: [
      {
        name: "Human Nature", family: "CARPET_TILE", seasonYear: 2025, designCount: 12,
        designTemplate: { tileSizeMm: "500x500", hsn: "5703", gstRate: 5, sellUnit: "PIECE", family: "CARPET_TILE", priceRangePaise: [80000, 200000] },
      },
      {
        name: "Embodied Beauty", family: "CARPET_TILE", seasonYear: 2025, designCount: 10,
        designTemplate: { tileSizeMm: "500x500", hsn: "5703", gstRate: 5, sellUnit: "PIECE", family: "CARPET_TILE", priceRangePaise: [100000, 250000] },
      },
      {
        name: "Urban Retreat", family: "CARPET_TILE", seasonYear: 2024, designCount: 9,
        designTemplate: { tileSizeMm: "500x500", hsn: "5703", gstRate: 5, sellUnit: "PIECE", family: "CARPET_TILE", priceRangePaise: [70000, 180000] },
      },
    ],
  },

  // ── FILMS (2 brands) ──────────────────────────────────────────────────────
  {
    name: "3M", country: "United States", leadTimeDays: 14,
    families: ["INTERIOR_FILM"],
    collections: [
      {
        name: "DI-NOC Architectural", family: "INTERIOR_FILM", seasonYear: 2025, designCount: 15,
        designTemplate: { rollWidthMm: 1220, rollLengthM: 25, patternRepeats: [0], patternMatches: ["FREE"], hsn: "3919", gstRate: 18, sellUnit: "SQFT", family: "INTERIOR_FILM", priceRangePaise: [12000, 35000] },
      },
      {
        name: "Fasara Glass Films", family: "INTERIOR_FILM", seasonYear: 2025, designCount: 12,
        designTemplate: { rollWidthMm: 1220, rollLengthM: 30, patternRepeats: [0], patternMatches: ["FREE"], hsn: "3919", gstRate: 18, sellUnit: "SQFT", family: "INTERIOR_FILM", priceRangePaise: [8000, 22000] },
      },
      {
        name: "Exterior Films", family: "INTERIOR_FILM", seasonYear: 2024, designCount: 8,
        designTemplate: { rollWidthMm: 1524, rollLengthM: 22, patternRepeats: [0], patternMatches: ["FREE"], hsn: "3919", gstRate: 18, sellUnit: "SQFT", family: "INTERIOR_FILM", priceRangePaise: [15000, 40000] },
      },
      {
        name: "Safety & Security", family: "INTERIOR_FILM", seasonYear: 2024, designCount: 6,
        designTemplate: { rollWidthMm: 1524, rollLengthM: 30, patternRepeats: [0], patternMatches: ["FREE"], hsn: "3919", gstRate: 18, sellUnit: "SQFT", family: "INTERIOR_FILM", priceRangePaise: [20000, 55000] },
      },
    ],
  },
  {
    name: "LG Hausys", country: "South Korea", leadTimeDays: 21,
    families: ["INTERIOR_FILM"],
    collections: [
      {
        name: "Hi-Macs Solid", family: "INTERIOR_FILM", seasonYear: 2025, designCount: 11,
        designTemplate: { rollWidthMm: 1220, rollLengthM: 25, patternRepeats: [0], patternMatches: ["FREE"], hsn: "3919", gstRate: 18, sellUnit: "SQFT", family: "INTERIOR_FILM", priceRangePaise: [11000, 30000] },
      },
      {
        name: "Hflor Luxury Vinyl", family: "INTERIOR_FILM", seasonYear: 2025, designCount: 9,
        designTemplate: { rollWidthMm: 1830, rollLengthM: 25, patternRepeats: [0], patternMatches: ["FREE"], hsn: "3919", gstRate: 18, sellUnit: "SQFT", family: "INTERIOR_FILM", priceRangePaise: [9000, 24000] },
      },
      {
        name: "Wood Grain Series", family: "INTERIOR_FILM", seasonYear: 2024, designCount: 10,
        designTemplate: { rollWidthMm: 1220, rollLengthM: 25, patternRepeats: [0, 300], patternMatches: ["FREE","STRAIGHT"], hsn: "3919", gstRate: 18, sellUnit: "SQFT", family: "INTERIOR_FILM", priceRangePaise: [10000, 27000] },
      },
    ],
  },

  // ── VERTICAL GARDEN (1 brand) ─────────────────────────────────────────────
  {
    name: "Plantscape", country: "India", leadTimeDays: 14,
    families: ["VERTICAL_GARDEN"],
    collections: [
      {
        name: "Indoor Green Wall", family: "VERTICAL_GARDEN", seasonYear: 2025, designCount: 8,
        designTemplate: { hsn: "0604", gstRate: 5, sellUnit: "SQFT", family: "VERTICAL_GARDEN", priceRangePaise: [60000, 180000] },
      },
      {
        name: "Outdoor Garden Wall", family: "VERTICAL_GARDEN", seasonYear: 2024, designCount: 6,
        designTemplate: { hsn: "0604", gstRate: 5, sellUnit: "SQFT", family: "VERTICAL_GARDEN", priceRangePaise: [80000, 240000] },
      },
      {
        name: "Moss Panels", family: "VERTICAL_GARDEN", seasonYear: 2024, designCount: 5,
        designTemplate: { hsn: "0604", gstRate: 5, sellUnit: "SQFT", family: "VERTICAL_GARDEN", priceRangePaise: [50000, 140000] },
      },
    ],
  },
] as const;

// Colourway names per family, used to generate realistic colourway data
export const COLOUR_NAMES: Record<string, string[]> = {
  WALLPAPER: [
    "Pearl White","Ivory Cream","Dove Grey","Slate Blue","Forest Green","Dusty Rose",
    "Warm Taupe","Terracotta","Midnight Navy","Sage Green","Blush Pink","Charcoal",
    "Sand Dollar","Mist Grey","Antique Gold","Teal Blue","Rust Orange","Pale Lavender",
    "Warm White","Graphite","Ocean Blue","Linen Beige","Moss Green","Soft Blush",
  ],
  CURTAIN_FABRIC: [
    "Ivory","Cream","Natural Linen","Pearl Grey","Dove White","Dusty Teal",
    "Warm Sand","Navy Blue","Blush Pink","Charcoal","Sage","Slate Grey",
    "Camel","Burnt Sienna","Forest","Cobalt","Rose Gold","Off White",
    "Mushroom","Midnight","Steel Blue","Wheat","Olive","Mauve",
  ],
  SHEER: [
    "White","Off White","Cream","Ivory","Silver","Champagne","Pearl",
    "Blush","Soft Grey","Linen","Natural","Ecru","Oyster",
  ],
  LINING: [
    "White","Cream","Ivory","Blackout White","Blackout Cream","Thermal Ivory",
  ],
  BLIND: [
    "White","Off White","Cream","Beige","Sand","Stone","Grey","Charcoal",
    "Navy","Blue","Teal","Green","Terracotta","Black","Brown","Tan",
    "Slate","Silver","Bronze","Espresso",
  ],
  FLOORING: [
    "Natural Oak","White Oak","Smoked Oak","Warm Chestnut","Driftwood","Wenge",
    "Light Ash","Dark Walnut","Blonde Pine","Rustic Hickory","Sand Stone","Grey Stone",
    "Herringbone Oak","Chevron Walnut","Classic Maple","Heritage Brown",
  ],
  CARPET_ROLL: [
    "Silver Grey","Champagne Beige","Dove","Warm Taupe","Heather","Smoke",
    "Natural","Flint","Pebble","Sand","Twist Pearl","Loop Charcoal",
  ],
  CARPET_TILE: [
    "Graphite","Slate","Ash","Dusk","Smoke","Cloud","Stone","Wheat",
    "Bark","Moss","Sea","Steel","Gravel","Fog",
  ],
  INTERIOR_FILM: [
    "Brushed Aluminium","Stainless Steel","Black Carbon","White Marble","Carrara Marble",
    "Concrete Grey","Oak Wood","Walnut Wood","Mahogany","Light Wood",
    "Frosted Clear","Smoke Grey","Bronze","Champagne Gold","Matte Black",
  ],
  VERTICAL_GARDEN: [
    "Tropical Mix","Fern Green","Moss Collection","Desert Succulents","Boxwood Classic",
    "Ivy Blend","Preserved Green","Air Plants","Mixed Foliage",
  ],
};

// Hex codes matched to colour names
export const COLOUR_HEX: Record<string, string> = {
  "Pearl White": "#F8F6F1","Ivory Cream": "#FAF6E8","Dove Grey": "#A8A8A8",
  "Slate Blue": "#6B7FA0","Forest Green": "#2D5A3D","Dusty Rose": "#C4956A",
  "Warm Taupe": "#B5A090","Terracotta": "#C0623A","Midnight Navy": "#1A2744",
  "Sage Green": "#8FAF8A","Blush Pink": "#E8C4B8","Charcoal": "#3D3D3D",
  "Sand Dollar": "#E8DCC8","Mist Grey": "#C8CDD6","Antique Gold": "#C9A227",
  "Teal Blue": "#2A7F82","Rust Orange": "#C4622A","Pale Lavender": "#C4B8D4",
  "Warm White": "#FFFEF8","Graphite": "#4A4A4A","Ocean Blue": "#2B5B8C",
  "Linen Beige": "#E8E0D0","Moss Green": "#6B7C52","Soft Blush": "#F2C4B8",
  "Ivory": "#FFFFF0","Cream": "#FFF8DC","Natural Linen": "#E8D5B7",
  "Pearl Grey": "#D0D0D0","Dove White": "#F8F8F8","Dusty Teal": "#7BA7A7",
  "Warm Sand": "#D4C4A0","Navy Blue": "#1A1F71","White": "#FFFFFF",
  "Off White": "#FFFFF8","Silver": "#C0C0C0","Champagne": "#F7E7CE",
  "Pearl": "#F0EAD6","Natural": "#C8B89A","Ecru": "#F0E68C",
  "Oyster": "#E8DCC8","Brushed Aluminium": "#9B9B9B","Stainless Steel": "#B8B8B0",
  "Black Carbon": "#1A1A1A","White Marble": "#F8F8F4","Carrara Marble": "#F0EFEC",
  "Concrete Grey": "#808080","Oak Wood": "#8B6914","Walnut Wood": "#5C3A1E",
  "Natural Oak": "#C8A870","White Oak": "#E8D4B0","Smoked Oak": "#6B5040",
  "Warm Chestnut": "#954535","Driftwood": "#B0A090","Wenge": "#3C2415",
};
