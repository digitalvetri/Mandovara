// §6.4 — the dye-lot allocation console.
//
// This page was removed from the sidebar earlier on request;
// docs/HANDOVER-CHECKLIST.md lists restoring it as REQUIRED before real client
// data goes in, and §0.6 / §15.4 make the mixed-lot gate a non-negotiable.
// The server-side gate never went away (src/modules/allocation/core.ts) — only
// the surface that lets a store keeper see and use it, which is where the
// "wallpaper doesn't match" incident actually gets prevented.

import { Topbar } from "@/components/layout/Topbar";
import { EmptyState } from "@/components/states";
import { devContext } from "@/lib/dev-context";
import { listOpenOrderLines } from "@/modules/allocation/queries";
import { AllocationConsole } from "./_components/AllocationConsole";

export const dynamic = "force-dynamic";

export default async function AllocationPage() {
  const ctx   = await devContext();
  const lines = await listOpenOrderLines(ctx);

  const mixed = lines.filter((l) => l.existingLotCount > 1).length;

  return (
    <>
      <Topbar
        title="Dye-lot allocation"
        eyebrow={
          `${lines.length} order line${lines.length === 1 ? "" : "s"} awaiting material` +
          (mixed > 0 ? ` · ${mixed} on mixed lots` : "")
        }
      />

      <div className="pb-10">
        <p className="text-[12.5px] text-text-muted max-w-[70ch] mb-5">
          Material reserved for one job must come from one dye lot. Allocating a
          second lot to the same line is blocked; overriding it needs a written
          reason and is recorded against your name.
        </p>

        {lines.length === 0 ? (
          <EmptyState
            title="Nothing waiting for material"
            description="Confirmed order lines appear here once they need stock reserving against a dye lot."
          />
        ) : (
          <AllocationConsole lines={lines} />
        )}
      </div>
    </>
  );
}
