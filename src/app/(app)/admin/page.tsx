import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { loadAdmin } from "@/modules/admin/queries";
import { listEmployees } from "@/modules/employees/queries";
import { AddUserForm } from "./_components/AddUserForm";
import { CompanySettingsForm } from "./_components/CompanySettingsForm";
import { EmployeesSection } from "./_components/EmployeesSection";
import { BranchGeofenceSection } from "./_components/BranchGeofenceSection";
import { PeopleAndAuditSection } from "./_components/PeopleAndAuditSection";
import { getAuditRetentionDays } from "@/modules/admin/audit-retention";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await devContext();
  const [a, employees, retentionDays] = await Promise.all([
    loadAdmin(ctx),
    listEmployees(ctx, { includeTerminated: true }),
    getAuditRetentionDays(),
  ]);

  return (
    <>
      <Topbar
        title="Administration, Roles & Audit"
        eyebrow="Users, permissions, audit log and org settings"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6">
            <div className="flex items-baseline justify-between mb-4">
              <div className="font-display text-[18px] font-semibold">Users & roles</div>
              <AddUserForm roles={a.roles} branches={a.branches} />
            </div>
            {a.users.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-text-faint">
                No users yet. Add your team so they can sign in.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                      <Th>Name</Th><Th>Role</Th><Th>Branch</Th><Th>Email</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.users.map((u) => (
                      <tr key={u.id} className="border-b border-rule/60 last:border-0">
                        <Td>{u.name}</Td>
                        <Td className="text-text-dim">{u.role}</Td>
                        <Td className="text-text-dim">{u.branchLabel}</Td>
                        <Td className="text-text-faint tabular text-[11px]">{u.email}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <EmployeesSection
            employees={employees.rows}
            branches={a.branches}
            activeCount={employees.activeCount}
            totalCount={employees.totalCount}
          />

          <BranchGeofenceSection branches={a.branches} />

          <PeopleAndAuditSection retentionDays={retentionDays} />

        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6">
            <div className="font-display text-[18px] font-semibold mb-4">Audit log</div>
            {a.audit.length === 0 ? (
              <div className="text-[12px] text-text-faint py-4">Nothing audited yet.</div>
            ) : (
              <ul className="space-y-3 text-[12px]">
                {a.audit.map((row) => (
                  <li key={row.id} className="pb-3 border-b border-rule/60 last:border-0 last:pb-0">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <div className="text-text">{row.actor} — <span className="text-text-dim">{row.action}</span></div>
                      <div className="text-[10.5px] text-text-faint tabular">{row.when}</div>
                    </div>
                    <div className="text-[11px] text-text-dim">{row.entity}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <CompanySettingsForm initial={a.company} />

          <div className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6">
            <div className="font-display text-[18px] font-semibold mb-1">Role permissions</div>
            <p className="text-[12px] text-text-dim mb-4">
              Fine-grained permission matrix — grant or revoke actions per role.
            </p>
            <a
              href="/admin/roles"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-gold/10 border border-gold/30 text-[12px] text-gold font-medium hover:bg-gold/20 transition-colors"
            >
              Open permission matrix →
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 h-[34px] font-medium text-left">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 text-left ${className}`}>{children}</td>;
}
