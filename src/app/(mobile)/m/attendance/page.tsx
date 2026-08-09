// /m/attendance — mobile attendance surface (Phase 7b).
//
// Employee picker + one-tap status buttons + GPS location captured
// via navigator.geolocation. Uses the same IndexedDB outbox as
// /m/install/[visitId] — offline punches queue and drain on
// reconnect. §14 gate item "punch offline → sync" is proven by
// scripts/tmp/verify-7b-pwa.mjs.

import { devContext } from "@/lib/dev-context";
import { listEmployeesForPicker } from "@/modules/employees/queries";
import { AttendanceSurface } from "./_components/AttendanceSurface";

export const dynamic = "force-dynamic";

export default async function MobileAttendancePage() {
  const ctx = await devContext();
  const employees = await listEmployeesForPicker(ctx);
  return <AttendanceSurface employees={employees} />;
}
