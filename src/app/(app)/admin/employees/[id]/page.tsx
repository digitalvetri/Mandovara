import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Phone, Briefcase, Calendar as CalendarIcon } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getEmployeeById } from "@/modules/employees/queries";
import { listTasksForUser } from "@/modules/tasks/queries";
import { AssignTaskButton } from "./_components/AssignTaskButton";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  ACTIVE:     "bg-good/12 text-good",
  ON_LEAVE:   "bg-warn/15 text-warn",
  SUSPENDED:  "bg-fault/12 text-fault",
  RESIGNED:   "bg-text-dim/12 text-text-dim",
  TERMINATED: "bg-bad/12 text-bad",
};

const PRIORITY_TONE: Record<string, string> = {
  URGENT: "bg-fault/12 text-fault",
  HIGH:   "bg-heat/15 text-heat",
  NORMAL: "bg-surface-2 text-text-dim",
  LOW:    "bg-surface-2 text-text-faint",
};

const STATUS_LABEL: Record<string, string> = {
  TODO:        "To do",
  IN_PROGRESS: "In progress",
  BLOCKED:     "Blocked",
  DONE:        "Done",
};

export default async function EmployeeDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const employee = await getEmployeeById(ctx, id);
  if (!employee) notFound();

  const tasks = employee.userId
    ? await listTasksForUser(ctx, employee.userId, { openOnly: false, limit: 50 })
    : [];

  const openTasks = tasks.filter((t) => t.status !== "DONE");
  const doneTasks = tasks.filter((t) => t.status === "DONE");

  return (
    <>
      <Topbar title={employee.name} eyebrow={`${employee.designation ?? employee.department ?? "Employee"} · ${employee.code}`} />

      <div className="mb-4">
        <Link
          href={"/admin" as Route}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.75} />
          Admin
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">

        <aside className="rounded-[14px] bg-surface border border-rule p-5 h-fit">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Profile</div>
          <div className="space-y-3 text-[12.5px]">
            <Row k="Code"        v={employee.code}        mono />
            <Row k="Mobile"      v={employee.mobile}      mono icon={<Phone size={11} />} />
            <Row k="Designation" v={employee.designation ?? "—"} />
            <Row k="Department"  v={employee.department  ?? "—"} icon={<Briefcase size={11} />} />
            <Row k="Joined"      v={employee.joinDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} icon={<CalendarIcon size={11} />} />
            <Row k="Status"      v={
              <span className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${STATUS_TONE[employee.status] ?? "bg-text-dim/12 text-text-dim"}`}>
                {employee.status.replace("_", " ")}
              </span>
            } />
          </div>
          {!employee.userId && (
            <div className="mt-4 rounded-[8px] border border-heat/30 bg-heat/8 p-3 text-[11.5px] text-heat leading-relaxed">
              This employee doesn&apos;t have a login yet. They need to sign in with mobile <span className="tabular font-medium">{employee.mobile}</span> once — after that you can assign tasks that show up on their dashboard.
            </div>
          )}
        </aside>

        <section className="space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-6">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
                Assigned Tasks {openTasks.length > 0 && <span className="text-text tabular">({openTasks.length} open)</span>}
              </div>
              {employee.userId && (
                <AssignTaskButton
                  employeeName={employee.name}
                  assignedToUserId={employee.userId}
                />
              )}
            </div>

            {openTasks.length === 0 ? (
              <div className="py-6 text-center text-[12.5px] text-text-faint">
                No open tasks {employee.userId ? "— click Assign task to give them something." : "— employee needs to sign in first."}
              </div>
            ) : (
              <ul className="divide-y divide-rule/60">
                {openTasks.map((t) => (
                  <li key={t.id} className="py-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-text">{t.title}</span>
                      <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] px-1.5 py-0.5 rounded-[4px] ${PRIORITY_TONE[t.priority] ?? "bg-surface-2 text-text-dim"}`}>
                        {t.priority}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-text-dim">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                      {t.dueAt && (
                        <span className="text-[11px] text-text-dim tabular">
                          due {t.dueAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })}
                        </span>
                      )}
                    </div>
                    {t.description && <div className="mt-1 text-[11.5px] text-text-dim">{t.description}</div>}
                    <div className="mt-1 text-[10.5px] text-text-faint">
                      Assigned by {t.createdByName} · <span className="tabular">{t.number}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {doneTasks.length > 0 && (
            <div className="rounded-[14px] bg-surface border border-rule p-6">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
                Completed ({doneTasks.length})
              </div>
              <ul className="divide-y divide-rule/60">
                {doneTasks.slice(0, 15).map((t) => (
                  <li key={t.id} className="py-2 flex items-baseline justify-between gap-3">
                    <span className="text-[12.5px] text-text-dim line-through decoration-text-faint truncate">{t.title}</span>
                    {t.completedAt && (
                      <span className="text-[10.5px] text-text-faint tabular shrink-0">
                        {t.completedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Row({ k, v, mono, icon }: { k: string; v: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim inline-flex items-center gap-1.5 text-[11.5px]">
        {icon && <span className="text-text-faint">{icon}</span>}
        {k}
      </dt>
      <dd className={`text-text text-right ${mono ? "tabular" : ""}`}>{v}</dd>
    </div>
  );
}
