// Human-friendly display shortener for kernel-allocated document numbers.
//
// The kernel enforces a formal, gap-free format for every document:
//   ${branch.invoicePrefix}/${docType}/${FY}/${paddedSeq}
//   e.g. "MDV/CHE/PRJ/26-27/00001"
//
// That's what's stored in the DB (Rule 6). For internal-only documents
// (projects, tasks, snags, stock adjustments, …) the full string is too
// long for the UI — this helper extracts the sequence and puts a short
// type prefix on it. GST-relevant documents (Invoice, Credit Note) should
// keep the full format on-screen because those numbers are the legal
// identifier.

export function shortNumber(fullNumber: string | null | undefined, prefix = "#"): string {
  if (!fullNumber) return "—";
  const parts = fullNumber.split("/");
  const seq = parts[parts.length - 1] ?? fullNumber;
  const n = parseInt(seq, 10);
  if (!Number.isFinite(n)) return fullNumber;
  return `${prefix}${n}`;
}
