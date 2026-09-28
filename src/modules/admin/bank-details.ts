// The studio's bank account, printed on every quotation as "Company's
// Bank Details" (owner request, 2026-09-28, matching the block on the
// studio's existing paper quotations).
//
// Kept in the Setting table under one key — the same place the audit
// retention window lives — so no schema change was needed, and it is
// changed from Administration → Bank details.
//
// A plain module: the admin form, the server actions and both PDF routes
// read the same shape.

import { z } from "zod";

export const BANK_DETAILS_KEY = "quotation.bankDetails";

export interface BankDetails {
  bankName:      string;
  accountName:   string;
  accountNumber: string;
  branch:        string;
  ifsc:          string;
}

export const EMPTY_BANK_DETAILS: BankDetails = {
  bankName: "", accountName: "", accountNumber: "", branch: "", ifsc: "",
};

// IFSC is 4 letters, a zero, then 6 letters or digits (RBI format).
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const bankDetailsInput = z.object({
  bankName:      z.string().trim().max(120),
  accountName:   z.string().trim().max(120),
  accountNumber: z.string().trim().max(40)
    .refine((v) => v === "" || /^[A-Za-z0-9 -]+$/.test(v), "Letters, digits and spaces only"),
  branch:        z.string().trim().max(120),
  ifsc:          z.string().trim().toUpperCase()
    .refine((v) => v === "" || IFSC.test(v), "IFSC is 11 characters, e.g. PUNB0009800"),
}).refine(
  // All blank clears the block; otherwise the two things a client needs
  // to actually pay must both be there.
  (d) => isBlank(d) || (d.bankName !== "" && d.accountNumber !== ""),
  { message: "Bank name and account number are both needed", path: ["accountNumber"] },
);

function isBlank(d: BankDetails): boolean {
  return Object.values(d).every((v) => v.trim() === "");
}

/** Read the Setting value back; anything unexpected reads as blank. */
export function readBankDetails(raw: unknown): BankDetails {
  if (!raw || typeof raw !== "object") return { ...EMPTY_BANK_DETAILS };
  const r = raw as Record<string, unknown>;
  const str = (k: keyof BankDetails) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  return {
    bankName:      str("bankName"),
    accountName:   str("accountName"),
    accountNumber: str("accountNumber"),
    branch:        str("branch"),
    ifsc:          str("ifsc").toUpperCase(),
  };
}

/** Only print the block when there is an account to pay into. */
export function hasBankDetails(d: BankDetails | null | undefined): d is BankDetails {
  return !!d && d.bankName !== "" && d.accountNumber !== "";
}

/** "COIMBATORE MAIN & PUNB0009800" — how the studio's paper quotes print it. */
export function branchAndIfsc(d: BankDetails): string {
  return [d.branch, d.ifsc].filter(Boolean).join(" & ");
}
