"use client";

// Owns the interactive state for the Next Action hero:
//   - the "Start measurement" button (via NextActionCard)
//   - the "Schedule visit" sheet (ENQUIRY-stage action)
//   - the "Open on phone" QR modal
//   - the room-setup sheet that appears when the project has no rooms
//
// Kept as one client component so the server page.tsx can stay a plain
// Server Component and pass a fully-resolved NextAction down as data.

import { useState } from "react";
import { NextActionCard } from "./NextActionCard";
import { OpenOnPhoneModal } from "./OpenOnPhoneModal";
import { RoomSetupSheet } from "./RoomSetupSheet";
import { ScheduleVisitSheet } from "./ScheduleVisitSheet";
import type { NextAction } from "@/modules/projects/next-action";

interface Props {
  projectId: string;
  action: NextAction;
  currentUserId: string;
}

export function StartMeasurementFlow({ projectId, action, currentUserId }: Props) {
  const [showQr, setShowQr] = useState(false);
  const [needsRoomsOpen, setNeedsRoomsOpen] = useState(false);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);

  return (
    <>
      <NextActionCard
        projectId={projectId}
        action={action}
        onNeedsRooms={() => setNeedsRoomsOpen(true)}
        onOpenOnPhone={() => setShowQr(true)}
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

      <OpenOnPhoneModal
        projectId={projectId}
        open={showQr}
        onClose={() => setShowQr(false)}
      />
    </>
  );
}
