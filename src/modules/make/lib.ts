// Pure cut-list resolution logic — called by createMakeJob and tested directly.
// Priority: frozen QuotationLine.calcSnapshot (sent quote) > live CalcResult.
// This ensures the tailor's cut list is identical to what was quoted (§7.7 rule 6).

export type CalcSnap = {
  widthsRequired?: number | null;
  cutLengthMm?: string | null;
  liningQty?: string | null;
  fabricRun?: string | null;
  headingType?: string | null;
  eyeletCount?: number | null;
  warnings?: string[];
  engineVersion?: string;
};

export type OrderLineForMake = {
  id: string;
  description: string;
  measurementItemId: string | null;
};

export type QLineForCutList = {
  measurementItemId: string | null;
  roomLabel: string | null;
  calcSnapshot: unknown;
};

export type LiveCalcResult = {
  measurementItemId: string;
  widthsRequired: number | null;
  cutLengthMm: { toString(): string } | null;
  liningQty: { toString(): string } | null;
  fabricRun: string | null;
  warnings: string[];
  engineVersion: string;
};

export type RoomLabelItem = {
  id: string;
  label: string;
  room: { name: string };
};

export type ResolvedCutLine = {
  orderLineId: string;
  measurementItemId: string | null;
  roomLabel: string;
  snap: CalcSnap | undefined;
};

/**
 * Resolves per-line cut data for a make job.
 *
 * For each order line, the frozen `calcSnapshot` from the corresponding
 * QuotationLine takes precedence over the live CalcResult. This means a
 * measurement revision after the quote is sent cannot silently change the
 * panels or cut length the tailor works from.
 */
export function resolveCutList(params: {
  orderLines: OrderLineForMake[];
  qLines: QLineForCutList[];
  liveCalcs: LiveCalcResult[];
  roomItems: RoomLabelItem[];
}): ResolvedCutLine[] {
  const snapMap = new Map<string, CalcSnap>();
  const roomLabelMap = new Map<string, string>();

  // First pass: frozen snapshots from sent quotation lines
  for (const l of params.qLines) {
    if (!l.measurementItemId) continue;
    if (l.calcSnapshot) snapMap.set(l.measurementItemId, l.calcSnapshot as CalcSnap);
    if (l.roomLabel) roomLabelMap.set(l.measurementItemId, l.roomLabel);
  }

  // Second pass: live CalcResults only for lines without a frozen snapshot
  for (const c of params.liveCalcs) {
    if (!snapMap.has(c.measurementItemId)) {
      snapMap.set(c.measurementItemId, {
        widthsRequired: c.widthsRequired,
        cutLengthMm: c.cutLengthMm?.toString() ?? null,
        liningQty: c.liningQty?.toString() ?? null,
        fabricRun: c.fabricRun ?? undefined,
        warnings: c.warnings,
        engineVersion: c.engineVersion,
      });
    }
  }

  // Room labels from measurement items
  for (const item of params.roomItems) {
    if (!roomLabelMap.has(item.id)) {
      roomLabelMap.set(item.id, `${item.room.name} — ${item.label}`);
    }
  }

  return params.orderLines.map((l) => ({
    orderLineId: l.id,
    measurementItemId: l.measurementItemId,
    roomLabel:
      (l.measurementItemId ? roomLabelMap.get(l.measurementItemId) : undefined) ??
      l.description,
    snap: l.measurementItemId ? snapMap.get(l.measurementItemId) : undefined,
  }));
}
