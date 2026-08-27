// Makes it obvious the list is filtered to one client, and offers the
// way back out.
//
// A filtered list that looks identical to an unfiltered one is how
// someone concludes a measurement has gone missing.

import Link from "next/link";
import type { Route } from "next";

export function ClientFilterBanner({ clientName }: { clientName: string | null }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-accent/30 bg-accent/8 px-4 py-2.5">
      <span className="text-[12.5px] text-text">
        Showing every measurement for{" "}
        <span className="font-medium">{clientName ?? "this client"}</span>
        {" "}across all their projects.
      </span>
      <Link href={"/measurements" as Route} className="text-[11.5px] text-accent hover:underline">
        Show all
      </Link>
    </div>
  );
}
