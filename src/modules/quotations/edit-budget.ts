// How many times an employee may edit a quotation before an owner has to
// look at it.
//
// Owner, 2026-08-31: "if an employee prepares a quotation, that can be
// edited by the employee only for three times; more than three times the
// quotation should be approved by the admin, then only he can prepare or
// edit the quotation for the fourth time" — and, asked directly, approval
// grants three more rather than being a one-off pass.
//
// Pure functions, no database. The rule is the kind of thing that gets
// quietly re-implemented in a component and drifts, so it lives once and
// is unit-tested against the exact sequence the owner described.

/** Edits allowed per unlock. Three, then an owner has to intervene. */
export const EDIT_BUDGET = 3;

export interface EditBudgetState {
  /** Edits used since the last unlock (or since creation). */
  editCount: number;
  /** True for a user who can approve — an owner is never blocked. */
  canApprove: boolean;
}

export interface EditBudgetVerdict {
  allowed:   boolean;
  remaining: number;
  /** Set when allowed is false — shown to the employee verbatim. */
  reason?:   string;
}

/**
 * May this edit go ahead?
 *
 * An approver is never blocked: the gate exists so an owner sees the
 * quote, and an owner editing it has already seen it.
 */
export function checkEditBudget({ editCount, canApprove }: EditBudgetState): EditBudgetVerdict {
  const remaining = Math.max(0, EDIT_BUDGET - editCount);
  if (canApprove) return { allowed: true, remaining };
  if (editCount >= EDIT_BUDGET) {
    return {
      allowed: false,
      remaining: 0,
      reason:
        `You have used all ${EDIT_BUDGET} edits on this quotation. ` +
        `Ask the studio owner to unlock it — that gives you ${EDIT_BUDGET} more.`,
    };
  }
  return { allowed: true, remaining };
}

/** What to show above the editor, so nobody is surprised by the block. */
export function budgetLabel({ editCount, canApprove }: EditBudgetState): string {
  if (canApprove) return "Owner — edits are not limited";
  const remaining = Math.max(0, EDIT_BUDGET - editCount);
  if (remaining === 0) return "No edits left — needs the owner to unlock";
  if (remaining === 1) return "1 edit left before the owner has to unlock it";
  return `${remaining} edits left before the owner has to unlock it`;
}
