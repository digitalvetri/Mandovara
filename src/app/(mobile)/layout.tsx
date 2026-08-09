// Field/mobile route group — no sidebar chrome, viewport locked to
// device width so the installer works one-thumb. The (app) route
// group brings the Studio Console shell; this group is intentionally
// bare so /m/install/[visitId] gets the full screen.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mandovara Field",
  // A viewport hint isn't inherited from the root layout when set
  // via Next's `viewport` export — declare it locally so the phone
  // renders at 1× and no zoom-out on landscape.
  other: { viewport: "width=device-width, initial-scale=1, viewport-fit=cover" },
};

export default function MobileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-svh bg-bg text-text">
      {children}
    </div>
  );
}
