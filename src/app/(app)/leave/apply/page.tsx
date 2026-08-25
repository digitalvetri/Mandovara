import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { Topbar } from "@/components/layout/Topbar";
import { LeaveApplyClientForm } from "./_components/LeaveApplyClientForm";

export const dynamic = "force-dynamic";

export default async function LeaveApplyPage() {
  const ctx = await devContext();
  const db  = scoped(ctx);

  // Two-step employee lookup — same as employee dashboard
  let employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true, name: true, designation: true, department: true, code: true },
  });

  if (!employee) {
    const user = await db.user.findUnique({
      where:  { id: ctx.userId },
      select: { mobile: true, organizationId: true },
    });
    if (user) {
      employee = await db.employee.findFirst({
        where:  { mobile: user.mobile, organizationId: user.organizationId },
        select: { id: true, name: true, designation: true, department: true, code: true },
      });
    }
  }

  const recentLeaves = employee
    ? await db.leave.findMany({
        where:   { employeeId: employee.id },
        orderBy: { fromDate: "desc" },
        take:    6,
        select:  { id: true, type: true, fromDate: true, toDate: true, days: true, state: true },
      })
    : [];

  return (
    <>
      <Topbar title="Request Leave" eyebrow="leave application" />
      <LeaveApplyClientForm
        employee={employee ?? null}
        recentLeaves={recentLeaves.map((l) => ({
          ...l,
          fromDate: l.fromDate.toISOString(),
          toDate:   l.toDate.toISOString(),
          days:     Number(l.days),
        }))}
      />
    </>
  );
}
