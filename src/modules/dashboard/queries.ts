// Dashboard repository. All reads go through db.scoped(ctx) per Rule 1.
// The page consumes loadDashboard(ctx) and knows nothing about Prisma.


// Valid InvoiceStatus values that count toward revenue
export const REV_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID"] as const;

// Open LeadStage values — excludes WON and LOST
export const OPEN_LEAD_STAGES = [
  "NEW", "CONTACTED", "MEASUREMENT_SCHEDULED", "MEASURED", "QUOTED", "NEGOTIATION",
] as const;

// Active ProjectStage values — post-order, real work underway
export const ACTIVE_PROJECT_STAGES = [
  "ORDERED", "PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING",
] as const;

export const MONTHS_LOOKBACK = 8;
export const RECENT_ACTIVITY_LIMIT = 3;
export const SITE_VISITS_LIMIT = 3;
export const TEAM_PROJECTS_PREVIEW = 4;         // projects shown inline per member
// Live-work stages: anything from first visit through snagging counts
// as "in flight" for owner-load purposes. COMPLETED / CANCELLED drop off.
export const LIVE_STAGES = [
  "ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION",
  "ORDERED", "PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING",
] as const;

export * from "./queries-part2";
