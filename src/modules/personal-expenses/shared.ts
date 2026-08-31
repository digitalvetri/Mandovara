// Constants and row shapes for the personal-expense notebook.
//
// Separate from index.ts because that file is "use server" and such a
// module may only export async functions — the form needs the category
// list at render time. Same reason simple-families.ts exists.

/** Starting points, not a closed list — the field accepts anything. */
export const PERSONAL_CATEGORIES = [
  "Fuel", "Food", "Groceries", "Rent", "Utilities", "Travel",
  "Health", "Education", "Shopping", "Family", "Other",
] as const;

export interface PersonalExpenseRow {
  id:       string;
  category: string;
  note:     string | null;
  amount:   bigint;
  spentAt:  Date;
}

export interface PersonalSummary {
  rows:       PersonalExpenseRow[];
  total:      bigint;
  /** Descending by amount, so the biggest drain is first. */
  byCategory: { category: string; total: bigint }[];
}
