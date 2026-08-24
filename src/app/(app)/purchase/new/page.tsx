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
  let initialLines: { colourwayId: string; unit: SellUnit; quantity: string; rate: string }[] | undefined;

  if (params.requestId) {
    const pr = await db.purchaseRequest.findUnique({
      where:  { id: params.requestId },
      select: { lines: { select: { colourwayId: true, unit: true, quantity: true } } },
    });
    if (pr) {
      initialLines = pr.lines
        .filter((l) => l.colourwayId != null)
        .map((l) => ({
          colourwayId: l.colourwayId!,
          unit:        l.unit as SellUnit,
          quantity:    Number(l.quantity).toString(),
          rate:        "",
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
