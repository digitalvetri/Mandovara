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
        eyebrow="Employees, geofence, audit log and org settings"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          {/* The "Users & roles" table stood here. Removed 2026-08-29
              (owner): "User and roles in the Admin and Roles module is
              not needed as I only need the list of employees". It listed
              the same people as Employees below, from a different table,
              with a different set of columns — two answers on one screen
              to the question "who works here".

              The permission matrix at /admin/roles is untouched and still
              reachable: it is how a role gets a permission granted or
              revoked, which nothing else in the app can do. */}

          {/* The table went, but creating a login did not: an employee
              with no user account cannot sign in, and the password
              control on the row below says exactly that when asked to
              reset one. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-rule bg-surface px-5 py-4">
            <div>
              <div className="text-[14px] font-medium text-text">Login accounts</div>
              <p className="mt-0.5 text-[12.5px] text-text-dim">
                Give an employee a sign-in. Their password can be changed from the list below.
              </p>
            </div>
            <AddUserForm roles={a.roles} branches={a.branches} />
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


