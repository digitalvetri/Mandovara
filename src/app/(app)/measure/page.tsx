import { Topbar } from "@/components/layout/Topbar";
import { EstimatorPlayground } from "./_components/EstimatorPlayground";

export const dynamic = "force-dynamic";

export default function MeasurePage() {
  return (
    <>
      <Topbar
        title="Material Estimator"
        eyebrow="Type a dimension — fabric metres, roll count and boxes update in the same breath. This is the Measure & Material Engine wired to a screen."
      />
      <EstimatorPlayground />
    </>
  );
}
