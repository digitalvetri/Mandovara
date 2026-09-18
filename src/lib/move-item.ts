// Move one element of a list to another position — the reorder behind
// the quotation line handles (drag, ↑, ↓).
//
// Pure and copy-on-write: React state is replaced, never mutated. An
// out-of-range `from` or `to`, or a no-op move, returns the same array
// reference so a stray drop does not trigger a re-render or mark the
// quotation as unsaved.

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 || from >= list.length ||
    to < 0 || to >= list.length
  ) {
    return list as T[];
  }
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
