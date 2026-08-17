import { notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { AttendancePWA } from "./_components/AttendancePWA";

export const dynamic = "force-dynamic";

export default async function AttendanceMobilePage() {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true, name: true },
  });
  if (!employee) notFound();

  const now       = new Date();
  const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const attendance = await db.attendance.findUnique({
    where:  { employeeId_date: { employeeId: employee.id, date: todayDate } },
    select: { id: true, status: true, inAt: true, outAt: true, lockedAt: true },
  });

  return (
    <AttendancePWA
      employee={employee}
      attendance={
        attendance
          ? {
              id:     attendance.id,
              status: attendance.status,
              inAt:   attendance.inAt?.toISOString() ?? null,
              outAt:  attendance.outAt?.toISOString() ?? null,
              locked: !!attendance.lockedAt,
            }
          : null
      }
    />
  );
}
