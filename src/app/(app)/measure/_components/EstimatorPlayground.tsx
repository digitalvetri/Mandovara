"use client";

import { useState } from "react";
import { TabButton } from "./EstimatorAtoms";
import { WallpaperPanel, FlooringPanel, CurtainPanel } from "./EstimatorPanels";

type Tab = "wallpaper" | "flooring" | "curtain";

export function EstimatorPlayground() {
  const [tab, setTab] = useState<Tab>("wallpaper");

  return (
    <div className="pb-10">
      <div className="flex items-center gap-1 mb-5 border-b border-rule">
        <TabButton active={tab === "wallpaper"} onClick={() => setTab("wallpaper")}>
          Wallpaper
        </TabButton>
        <TabButton active={tab === "flooring"} onClick={() => setTab("flooring")}>
          Flooring
        </TabButton>
        <TabButton active={tab === "curtain"} onClick={() => setTab("curtain")}>
          Curtains
        </TabButton>
      </div>

      {tab === "wallpaper" && <WallpaperPanel />}
      {tab === "flooring"  && <FlooringPanel  />}
      {tab === "curtain"   && <CurtainPanel   />}
    </div>
  );
}
