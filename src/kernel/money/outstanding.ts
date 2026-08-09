// computeOutstanding — the ONE formula for invoice outstanding.
//
// outstanding = total − advanceAdjusted − Σ ReceiptAllocation.amount
//
// Used by: invoice queries, receipt allocation gate, cheque bounce logic,
// receipt allocation kernel. One formula, enforced by convention — do not
// re-derive inline.

export function computeOutstanding(
  total: bigint,
  advanceAdjusted: bigint,
  allocatedSum: bigint,
): bigint {
  const out = total - advanceAdjusted - allocatedSum;
  return out < 0n ? 0n : out;
}
