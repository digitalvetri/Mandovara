import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { can } from "@/kernel/rbac/guard";
import { formatDate } from "@/kernel/datetime";
import { LeaveApplyForm } from "./_components/LeaveApplyForm";
import { LeaveApprovalButtons } from "./_components/LeaveApprovalButtons";

export const dynamic = "force-dynamic";

const STATE_CHIP: Record<string, string> = {
  PENDING:  "bg-heat/12 text-heat",
  APPROVED: "bg-good/12 text-good",
  REJECTED: "bg-bad/12 text-bad",
};

const TYPE_LABEL: Record<string, string> = {
  CASUAL:   "Casual",
  SICK:     "Sick",
  EARNED:   "Earned",
  COMP_OFF: "Comp-off",
  UNPAID:   "Unpaid",
};

export default async function LeavePage() {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const canApprove = can(ctx, "leave.approve");

  const [leaves, employees] = await Promise.all([
    db.leave.findMany({
      where:   { organizationId: ctx.orgId },
      orderBy: { fromDate: "desc" },
      take:    100,
      select: {
        id: true, employeeId: true, type: true,
        fromDate: true, toDate: true, days: true,
        reason: true, state: true, decidedAt: true,
        rejectionReason: true, approvedById: true,
      },
    }),
    db.employee.findMany({
      where:   { organizationId: ctx.orgId },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, designation: true },
    }),
  ]);

  const employeeById = new Map(employees.map((e) => [e.id, e]));

  // Resolve approver names
  const approverIds = [...new Set(leaves.flatMap((l) => l.approvedById ? [l.approvedById] : []))];
  const approvers = approverIds.length > 0
    ? await db.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true } })
    : [];
  const approverName = new Map(approvers.map((u) => [u.id, u.name]));

  return (
    <>
      <Topbar
        title="Leave"
        eyebrow={`${leaves.filter((l) => l.state === "PENDING").length} pending · ${leaves.filter((l) => l.state === "APPROVED").length} approved`}
      />

      <div className="space-y-4 pb-10">

        {/* Apply form */}
        <div className="rounded-[14px] bg-surface border border-rule p-5">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-4">Apply for leave</div>
          <LeaveApplyForm employees={employees} />
        </div>

        {/* Leave list */}
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <div className="px-4 h-[38px] flex items-center border-b border-rule text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
            All leaves ({leaves.length})
          </div>
          {leaves.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-text-dim">No leave applications yet.</div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  <Th>Employee</Th>
                  <Th>Type</Th>
                  <Th>Period</Th>
                  <Th align="right">Days</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                  {canApprove && <Th>Actions</Th>}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => {
                  const emp = employeeById.get(l.employeeId);
                  return (
                    <tr key={l.id} className="border-b border-rule/60 last:border-0">
                      <Td>
                        <div className="font-medium text-text">{emp?.name ?? "—"}</div>
                        <div className="text-[10.5px] text-text-dim">{emp?.designation}</div>
                      </Td>
                      <Td className="text-text-dim">{TYPE_LABEL[l.type] ?? l.type}</Td>
                      <Td className="tabular text-text-dim">
                        {formatDate(l.fromDate)}
                        {l.fromDate.getTime() !== l.toDate.getTime() && ` – ${formatDate(l.toDate)}`}
                      </Td>
                      <Td align="right" className="tabular text-text-dim">
                        {Number(l.days)}
                      </Td>
                      <Td className="text-text-dim max-w-[180px] truncate">{l.reason ?? "—"}</Td>
                      <Td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium ${STATE_CHIP[l.state] ?? "bg-surface-2 text-text-dim"}`}>
                          {l.state}
                        </span>
                        {l.rejectionReason && (
                          <div className="text-[10px] text-bad mt-0.5">{l.rejectionReason}</div>
                        )}
                        {l.state === "APPROVED" && l.approvedById && (
                          <div className="text-[10px] text-text-dim mt-0.5">
                            by {approverName.get(l.approvedById) ?? "—"}
                          </div>
                        )}
                      </Td>
                      {canApprove && (
                        <Td>
                          {l.state === "PENDING" && <LeaveApprovalButtons id={l.id} />}
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({
  children, align = "left", className = "",
}: { children?: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"} ${className}`}>{children}</td>;
}
