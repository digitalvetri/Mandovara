// Reference data used by the seed. Kept small and factual.

// India state codes (subset — the ones actually generated in seed data).
export const STATE_CODES = {
  TN: "33", // Tamil Nadu — the home state (intra-state → CGST + SGST)
  KL: "32", // Kerala      — inter-state → IGST
  KA: "29", // Karnataka   — inter-state → IGST
} as const;

export const TN_CITIES = ["Coimbatore", "Chennai", "Madurai", "Salem", "Erode", "Tiruppur", "Trichy", "Vellore"];
export const KL_CITIES = ["Kochi", "Trivandrum", "Kozhikode", "Thrissur", "Palakkad"];
export const KA_CITIES = ["Bengaluru", "Mysuru", "Mangaluru", "Hubli"];

// Realistic Indian trading-company categories.
// Each has HSN prefixes and a GST rate typical of Indian construction/hardware trade.
export interface CategorySpec {
  slug: string;
  name: string;
  hsnPrefix: string;
  gstRate: number;                                    // %
  uom: string;
  uomPrecision: number;
  brands: readonly string[];
  specFields: readonly { key: string; label: string; type: "text" | "number" | "select"; options?: readonly string[] }[];
  namePatterns: readonly string[];
}

export const CATEGORIES: readonly CategorySpec[] = [
  {
    slug: "cement",
    name: "Cement & Concrete",
    hsnPrefix: "2523",
    gstRate: 28,
    uom: "BAG",
    uomPrecision: 0,
    brands: ["Ramco", "UltraTech", "Dalmia", "Chettinad", "ACC", "Ambuja"],
    specFields: [
      { key: "grade", label: "Grade", type: "select", options: ["OPC 43", "OPC 53", "PPC", "PSC"] },
      { key: "weight", label: "Weight", type: "select", options: ["50 kg", "25 kg"] },
    ],
    namePatterns: ["Cement Bag", "Portland Cement", "PPC Cement"],
  },
  {
    slug: "tmt",
    name: "TMT & Steel",
    hsnPrefix: "7214",
    gstRate: 18,
    uom: "KG",
    uomPrecision: 2,
    brands: ["TATA Tiscon", "JSW Neosteel", "SAIL", "Kamdhenu", "Vizag Steel"],
    specFields: [
      { key: "grade", label: "Grade", type: "select", options: ["Fe 415", "Fe 500", "Fe 500D", "Fe 550"] },
      { key: "diameter", label: "Diameter", type: "select", options: ["8mm", "10mm", "12mm", "16mm", "20mm", "25mm", "32mm"] },
      { key: "certification", label: "Certification", type: "select", options: ["ISI", "BIS", "None"] },
    ],
    namePatterns: ["TMT Bar", "Reinforcement Bar", "Steel Rod"],
  },
  {
    slug: "electrical",
    name: "Electrical",
    hsnPrefix: "8544",
    gstRate: 18,
    uom: "MTR",
    uomPrecision: 2,
    brands: ["Havells", "Polycab", "Anchor", "Finolex", "V-Guard", "Legrand"],
    specFields: [
      { key: "size", label: "Cross-section", type: "select", options: ["1.0 sq mm", "1.5 sq mm", "2.5 sq mm", "4 sq mm", "6 sq mm", "10 sq mm"] },
      { key: "type", label: "Type", type: "select", options: ["FR", "FRLS", "Multistrand"] },
      { key: "colour", label: "Colour", type: "select", options: ["Red", "Yellow", "Blue", "Black", "Green"] },
    ],
    namePatterns: ["Electrical Wire", "Copper Cable", "House Wire"],
  },
  {
    slug: "plumbing",
    name: "Plumbing",
    hsnPrefix: "3917",
    gstRate: 18,
    uom: "NOS",
    uomPrecision: 0,
    brands: ["Astral", "Supreme", "Finolex", "Prince", "Ashirvad"],
    specFields: [
      { key: "material", label: "Material", type: "select", options: ["CPVC", "UPVC", "PVC", "HDPE"] },
      { key: "diameter", label: "Diameter", type: "select", options: ["15mm", "20mm", "25mm", "32mm", "40mm", "50mm", "75mm", "110mm"] },
      { key: "length", label: "Length", type: "select", options: ["3m", "6m"] },
    ],
    namePatterns: ["Pipe", "Elbow", "Tee", "Coupling", "Bend"],
  },
  {
    slug: "tiles",
    name: "Tiles & Sanitary",
    hsnPrefix: "6907",
    gstRate: 18,
    uom: "SQF",
    uomPrecision: 2,
    brands: ["Kajaria", "Somany", "H&R Johnson", "Nitco", "Asian Granito"],
    specFields: [
      { key: "size", label: "Size", type: "select", options: ["300x300", "600x600", "600x1200", "800x800"] },
      { key: "finish", label: "Finish", type: "select", options: ["Glossy", "Matte", "Polished", "Wooden"] },
      { key: "kind", label: "Kind", type: "select", options: ["Floor", "Wall", "Vitrified"] },
    ],
    namePatterns: ["Floor Tile", "Wall Tile", "Vitrified Tile"],
  },
  {
    slug: "paint",
    name: "Paints",
    hsnPrefix: "3208",
    gstRate: 18,
    uom: "LTR",
    uomPrecision: 2,
    brands: ["Asian Paints", "Berger", "Nerolac", "Dulux", "Indigo"],
    specFields: [
      { key: "type", label: "Type", type: "select", options: ["Emulsion", "Enamel", "Distemper", "Primer", "Wood Finish"] },
      { key: "size", label: "Pack", type: "select", options: ["1L", "4L", "10L", "20L"] },
      { key: "sheen", label: "Sheen", type: "select", options: ["Matte", "Silk", "Gloss", "Semi-gloss"] },
    ],
    namePatterns: ["Interior Paint", "Exterior Paint", "Enamel Paint"],
  },
  {
    slug: "hardware",
    name: "Hardware & Fasteners",
    hsnPrefix: "7318",
    gstRate: 18,
    uom: "NOS",
    uomPrecision: 0,
    brands: ["Godrej", "Ozone", "Dorset", "Yale", "Hettich"],
    specFields: [
      { key: "size", label: "Size", type: "text" },
      { key: "material", label: "Material", type: "select", options: ["MS", "SS", "Brass", "Alloy"] },
      { key: "finish", label: "Finish", type: "select", options: ["Zinc", "Powder Coated", "Chrome", "Brass"] },
    ],
    namePatterns: ["Bolt", "Nut", "Hinge", "Latch", "Handle", "Lock", "Anchor"],
  },
  {
    slug: "safety",
    name: "Safety & Tools",
    hsnPrefix: "6506",
    gstRate: 12,
    uom: "NOS",
    uomPrecision: 0,
    brands: ["Karam", "Udyogi", "3M", "Honeywell", "MSA"],
    specFields: [
      { key: "kind", label: "Kind", type: "select", options: ["Helmet", "Harness", "Gloves", "Boots", "Goggles"] },
      { key: "size", label: "Size", type: "select", options: ["S", "M", "L", "XL"] },
      { key: "colour", label: "Colour", type: "select", options: ["White", "Yellow", "Blue", "Orange", "Red"] },
    ],
    namePatterns: ["Safety Helmet", "Safety Harness", "Safety Boots", "Work Gloves"],
  },
] as const;

export const ROLES = [
  { name: "Owner",         key: "OWNER" },
  { name: "Manager",       key: "MANAGER" },
  { name: "Sales Exec",    key: "SALES" },
  { name: "Storekeeper",   key: "STORE" },
  { name: "Accounts",      key: "ACCOUNTS" },
  { name: "HR",            key: "HR" },
  { name: "Site Engineer", key: "SITE" },
] as const;

// Sample of module.action permission keys (real registry in Session 4).
export const PERMISSION_KEYS = [
  "product.view", "product.create", "product.update", "product.viewCost",
  "client.view", "client.create", "client.creditLimit",
  "quotation.view", "quotation.create", "quotation.approve",
  "invoice.view", "invoice.create", "invoice.cancel",
  "grn.view", "grn.create",
  "stock.view", "stock.adjust", "stock.transfer",
  "receipt.view", "receipt.create",
  "payroll.view", "payroll.run",
  "attendance.view", "attendance.punch",
  "report.view", "admin.settings",
] as const;

export const FIRST_NAMES_TN = [
  "Anbu", "Selvi", "Karthik", "Meena", "Ravi", "Priya", "Suresh", "Deepa",
  "Vignesh", "Divya", "Bala", "Kavitha", "Prakash", "Anitha", "Manoj", "Latha",
];

export const LAST_NAMES_TN = [
  "Kumar", "Raj", "Murugan", "Krishnan", "Subramaniam", "Iyer", "Venkatesh",
  "Rajesh", "Prasad", "Natarajan",
];

export const COMPANY_SUFFIXES = [
  "Enterprises", "Traders", "Constructions", "Industries", "Engineering",
  "& Sons", "Hardware", "Steels", "Cement Depot", "Electricals",
];
