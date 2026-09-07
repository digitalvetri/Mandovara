// Shapes and wording for the project delete, shared by the server action
// and the confirm dialog.
//
// Separate from actions-delete.ts because that file is "use server" and
// such a module may only export async functions — describeBlockers() is
// a plain string builder the client component calls at render time. Same
// reason personal-expenses/shared.ts exists.

/** One reason a project cannot be deleted. */
export interface DeleteBlocker {
  label: string;
  count: number;
}

/** Human sentence for a blocker list — used by the dialog's warning and by
 *  the server action's refusal, so the user reads the same words in both. */
export function describeBlockers(blockers: DeleteBlocker[]): string {
  const parts = blockers.map(
    (b) => `${b.count} ${b.label}${b.count === 1 ? "" : "s"}`,
  );
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `This project has ${list}. Money and stock records can't be erased — cancel the project instead, which keeps the history and takes it off the active list.`;
}
