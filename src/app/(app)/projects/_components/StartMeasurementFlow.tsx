"use client";

// Owns the interactive state for the Next Action hero:
//   - the "Start measurement" button (via NextActionCard)
//   - the "Schedule visit" sheet (ENQUIRY-stage action)
//   - the room-setup sheet that appears when the project has no rooms
//
// Kept as one client component so the server page.tsx can stay a plain
// Server Component and pass a fully-resolved NextAction down as data.
//
// URL wizard flags (post-conversion continuous flow, spec-detail §4):
//   ?wizard=schedule-visit → auto-opens the Schedule Visit sheet on
//     mount. ConvertLeadModal redirects here so users don't have to
//     hunt for "what's next" after converting a lead.

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Route } from "next";
import { NextActionCard } from "./NextActionCard";
import { RoomSetupSheet } from "./RoomSetupSheet";
import { ScheduleVisitSheet } from "./ScheduleVisitSheet";
import type { NextAction } from "@/modules/projects/next-action";

interface Props {
  projectId: string;
  action: NextAction;
  currentUserId: string;
}

export function StartMeasurementFlow({ projectId, action, currentUserId }: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const params     = useSearchParams();
  const [needsRoomsOpen, setNeedsRoomsOpen] = useState(false);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);

  // Post-conversion wizard entry: land here from ConvertLeadModal with
  // ?wizard=schedule-visit and we pop the sheet automatically. Clear
  // the param afterwards so a page reload doesn't repeat it. A ref
  // guards against the effect double-firing after the URL replace
  // triggers a re-render.
  const wizardFired = useRef(false);
  useEffect(() => {
    if (wizardFired.current) return;
    if (params.get("wizard") !== "schedule-visit") return;
    wizardFired.current = true;
    setScheduleVisitOpen(true);
    const sp = new URLSearchParams(params.toString());
    sp.delete("wizard");
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}` as Route);
  }, [params, pathname, router]);

  return (
    <>
      <NextActionCard
        projectId={projectId}
        action={action}
        onNeedsRooms={() => setNeedsRoomsOpen(true)}
        onScheduleVisit={() => setScheduleVisitOpen(true)}
      />

      <RoomSetupSheet
        projectId={projectId}
        open={needsRoomsOpen}
        onClose={() => setNeedsRoomsOpen(false)}
        onDone={() => {
          setNeedsRoomsOpen(false);
          // Rooms exist now — kick the button again from the same flow so
          // the redirect fires. A page reload also does the trick but is
          // heavier; window.location.reload keeps this component self-
          // contained without router imports.
          if (typeof window !== "undefined") window.location.reload();
        }}
      />

      <ScheduleVisitSheet
        projectId={projectId}
        defaultAssigneeId={currentUserId}
        open={scheduleVisitOpen}
        onClose={() => setScheduleVisitOpen(false)}
      />
    </>
  );
}
