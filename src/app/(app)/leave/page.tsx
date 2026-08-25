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

const STATE_DOT: Record<string, string> = {
  PENDING:  "bg-heat",
  APPROVED: "bg-good",
  REJECTED: "bg-bad",
};

const TYPE_LABEL: Record<string, string> = {
  CASUAL:   "Casual",
  SICK:     "Sick",
  EARNED:   "Earned",
  COMP_OFF: "Comp-off",
  UNPAID:   "Unpaid",
};

const TYPE_COLOR: Record<string, string> = {
  CASUAL:   "bg-amber-500/10 text-amber-600",
  SICK:     "bg-red-500/10 text-red-500",
  EARNED:   "bg-purple-500/10 text-purple-500",
  COMP_OFF: "bg-blue-500/10 text-blue-500",
  UNPAID:   "bg-slate-400/10 text-slate-500",
};

export default async function LeavePage() {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const canApprove = can(ctx, "leave.approve");
  const canApply   = can(ctx, "leave.apply");

  const [leaves, employees] = await Promise.all([
    db.leave.findMany({
      where:   { organizationId: ctx.orgId },
      orderBy: { fromDate: "desc" },
      take:    120,
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

  const approverIds = [...new Set(leaves.flatMap((l) => l.approvedById ? [l.approvedById] : []))];
  const approvers   = approverIds.length > 0
    ? await db.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true } })
    : [];
  const approverName = new Map(approvers.map((u) => [u.id, u.name]));

  const pending  = leaves.filter((l) => l.state === "PENDING");
  const resolved = leaves.filter((l) => l.state !== "PENDING");

  return (
    <>
      <Topbar
        title="Leave"
        eyebrow={`${pending.length} pending · ${leaves.filter((l) => l.state === "APPROVED").length} approved`}
      />

      <div className="space-y-5 pb-10">

        {/* ── Pending approvals — prominent cards (visible to approvers) ── */}
        {canApprove && pending.length > 0 && (
          <section>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-3">
              Pending Approval ({pending.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {pending.map((l) => {
                const emp = employeeById.get(l.employeeId);
                const initials = emp
                  ? emp.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
                  : "?";
                const multi = l.fromDate.getTime() !== l.toDate.getTime();
                return (
                  <div
                    key={l.id}
                    className="rounded-[14px] border border-rule bg-surface overflow-hidden flex flex-col"
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-rule">
                      <div className="h-9 w-9 rounded-full bg-accent/12 border border-accent/20 flex items-center justify-center shrink-0 text-[12px] font-semibold text-accent">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-text truncate">{emp?.name ?? "—"}</div>
                        <div className="text-[10.5px] text-text-dim truncate">{emp?.designation ?? "—"}</div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[10.5px] font-semibold ${TYPE_COLOR[l.type] ?? "bg-surface-2 text-text-dim"}`}>
                        {TYPE_LABEL[l.type] ?? l.type}
                      </span>
                    </div>

                    {/* Card body */}
                    <div className="px-4 py-3 flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-[12.5px]">
                        <span className="text-text-dim">
                          {formatDate(l.fromDate)}
                          {multi ? ` – ${formatDate(l.toDate)}` : ""}
                        </span>
                        <span className="rounded-full bg-surface-2 border border-rule px-2 py-0.5 text-[10.5px] text-text-dim font-medium tabular">
                          {Number(l.days)}d
                        </span>
                      </div>
                      {l.reason && (
                        <p className="text-[11.5px] text-text-dim leading-relaxed line-clamp-2">
                          &ldquo;{l.reason}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Card footer — action */}
                    <div className="px-4 py-3 border-t border-rule bg-surface-2/40">
                      <LeaveApprovalButtons id={l.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── No pending — friendly empty state for approvers ─────────── */}
        {canApprove && pending.length === 0 && (
          <div className="rounded-[14px] border border-rule bg-surface px-5 py-8 text-center">
            <div className="text-[12.5px] text-text-dim">No pending leave requests. All caught up.</div>
          </div>
        )}

        {/* ── Apply on behalf (HR / manager only) ─────────────────────── */}
        {canApply && (
          <section className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-4">
              Apply on Behalf
            </div>
            <LeaveApplyForm employees={employees} />
          </section>
        )}

        {/* ── Full leave history table ─────────────────────────────────── */}
        <section>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-3">
            All Requests ({leaves.length})
          </div>
          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            {leaves.length === 0 ? (
              <div className="py-12 text-center text-[12px] text-text-dim">No leave applications yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-rule text-[10px] uppercase tracking-[0.14em] text-text-dim">
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
                        <tr key={l.id} className="border-b border-rule/60 last:border-0 hover:bg-surface-2/30 transition-colors">
                          <Td>
                            <div className="font-medium text-text">{emp?.name ?? "—"}</div>
                            <div className="text-[10.5px] text-text-dim">{emp?.designation}</div>
                          </Td>
                          <Td>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium ${TYPE_COLOR[l.type] ?? "bg-surface-2 text-text-dim"}`}>
                              {TYPE_LABEL[l.type] ?? l.type}
                            </span>
                          </Td>
                          <Td className="text-text-dim tabular">
                            {formatDate(l.fromDate)}
                            {l.fromDate.getTime() !== l.toDate.getTime() && ` – ${formatDate(l.toDate)}`}
                          </Td>
                          <Td align="right" className="tabular text-text-dim">{Number(l.days)}</Td>
                          <Td className="text-text-dim max-w-[160px] truncate">{l.reason ?? "—"}</Td>
                          <Td>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium ${STATE_CHIP[l.state] ?? "bg-surface-2 text-text-dim"}`}>
                              <span className={`h-1 w-1 rounded-full ${STATE_DOT[l.state] ?? "bg-text-dim"}`} />
                              {l.state.charAt(0) + l.state.slice(1).toLowerCase()}
                            </span>
                            {l.rejectionReason && (
                              <div className="text-[10px] text-bad mt-0.5 max-w-[140px] truncate" title={l.rejectionReason}>
                                {l.rejectionReason}
                              </div>
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
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 h-[34px] font-medium whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({
  children, align = "left", className = "",
}: { children?: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} ${className}`}>{children}</td>;
}
