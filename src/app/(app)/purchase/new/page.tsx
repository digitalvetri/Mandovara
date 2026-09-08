import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { listVendorsForPicker } from "@/modules/vendors/queries";
import { listColourwaysForPO } from "@/modules/purchase/queries";
import { POBuilder } from "../_components/POBuilder";

export const dynamic = "force-dynamic";

interface SearchParams { requestId?: string }

export default async function NewPOPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();
  const db  = scoped(ctx);

  const [vendors, colourways] = await Promise.all([
    listVendorsForPicker(ctx),
    listColourwaysForPO(ctx),
  ]);

  // Pre-populate lines from an approved purchase request
  type SellUnit = "METRE" | "ROLL" | "SQFT" | "SQM" | "PIECE" | "SET" | "BOX" | "RUNNING_FT";
  let initialLines: {
    colourwayId: string; freeTextItem: string; mode: "catalogue" | "typed";
    unit: SellUnit; quantity: string; rate: string; gstRate: string;
  }[] | undefined;

  if (params.requestId) {
    const pr = await db.purchaseRequest.findUnique({
      where:  { id: params.requestId },
      select: { lines: { select: { colourwayId: true, freeTextItem: true, unit: true, quantity: true } } },
    });
    if (pr) {
      // A request line that was typed rather than picked used to be dropped
      // here, because a PO line had to name a colourway. It no longer does,
      // so the whole request now converts.
      initialLines = pr.lines
        .filter((l) => l.colourwayId != null || l.freeTextItem != null)
        .map((l) => ({
          colourwayId:  l.colourwayId ?? "",
          freeTextItem: l.colourwayId ? "" : (l.freeTextItem ?? ""),
          mode:         (l.colourwayId ? "catalogue" : "typed") as "catalogue" | "typed",
          unit:         l.unit as SellUnit,
          quantity:     Number(l.quantity).toString(),
          rate:         "",
          gstRate:      "0",
        }));
    }
  }

  return (
    <>
      <Topbar title="New purchase order" eyebrow={params.requestId ? "Pre-filled from purchase request — add vendor and rates" : undefined} />
      <POBuilder vendors={vendors} colourways={colourways} initialLines={initialLines} />
    </>
  );
}
