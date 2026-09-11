// Table-row layout for QuotePdf.tsx — split out to keep that file under
// the §10 300-line ceiling, the same reason _pdf-table.tsx and
// _pdf-chrome.tsx exist.

import type { QuotationLine } from "@/modules/quotations/queries";

/** Undiscounted line value — what the source prints in the AMT column. */
export function grossOf(l: QuotationLine): bigint {
  const q = Number(l.quantity);
  if (!Number.isFinite(q)) return l.taxable;
  return BigInt(Math.round(Number(l.rate) * q));
}

/** Discount taken off one line, in paise. Zero when there is none. */
export function cutOf(l: QuotationLine): bigint {
  const cut = grossOf(l) - l.taxable;
  return cut > 0n ? cut : 0n;
}

function pctOf(l: QuotationLine): string {
  return String(parseFloat(Number(l.discountPct).toFixed(2)));
}

export type Block =
  | { kind: "group";    label: string }
  | { kind: "line";     line: QuotationLine }
  | { kind: "discount"; label: string; value: bigint };

/**
 * Lay the table out the way the studio does.
 *
 * Room names become bare caption rows. A run of consecutively discounted
 * lines is followed by its own red "LESS DIS. 25%" row and a spacer —
 * which is exactly where the sample puts it: after the two fabric lines
 * it applies to, above the track and labour that it does not. A run
 * whose lines carry different percentages has no single number to name,
 * so that row reads "LESS DISCOUNT" and lets the figure speak.
 */
export function layout(lines: QuotationLine[]): Block[] {
  const blocks: Block[] = [];
  let lastRoom: string | null = null;

  // Open discount run: what it totals and which percentages built it.
  let runTotal = 0n;
  let runPcts = new Set<string>();

  function closeRun(): void {
    if (runTotal === 0n) return;
    const only = runPcts.size === 1 ? [...runPcts][0] : null;
    blocks.push({
      kind:  "discount",
      label: only ? `LESS DIS. ${only}%` : "LESS DISCOUNT",
      value: -runTotal,
    });
    runTotal = 0n;
    runPcts = new Set();
  }

  for (const line of lines) {
    const cut = cutOf(line);
    // A line with no discount ends the run before it prints.
    if (cut === 0n) closeRun();

    const room = line.roomLabel?.trim() || null;
    if (room && room !== lastRoom) {
      closeRun();
      blocks.push({ kind: "group", label: room.toUpperCase() });
      lastRoom = room;
    }

    blocks.push({ kind: "line", line });
    if (cut > 0n) { runTotal += cut; runPcts.add(pctOf(line)); }
  }
  closeRun();

  return blocks;
}
