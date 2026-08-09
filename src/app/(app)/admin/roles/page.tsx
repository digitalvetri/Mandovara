// Permission matrix editor — /admin/roles
// Rows = permission modules, columns = roles, cells = checkbox.
// Owner role is shown read-only (all checked, greyed).

import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { loadPermMatrix } from "@/modules/admin/roles-queries";
import { PermMatrixClient } from "./_components/PermMatrixClient";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const ctx = await devContext();
  const matrix = await loadPermMatrix(ctx);

  return (
    <>
      <Topbar
        title="Role Permissions"
        eyebrow="Click a cell to grant or revoke — changes take effect on next sign-in"
      />

      <div className="pb-10">
        {/* Role cards */}
        <div className="flex flex-wrap gap-3 mb-6">
          {matrix.roles.map((role) => (
            <div key={role.id} className="rounded-[10px] bg-surface border border-rule px-4 py-3 min-w-[140px]">
              <div className="text-[13px] font-semibold text-text">{role.name}</div>
              {role.description && (
                <div className="text-[11px] text-text-dim mt-0.5 leading-tight">{role.description}</div>
              )}
              <div className="mt-2 text-[10.5px] tabular text-accent font-medium">
                {role.isOwnerRole ? "All permissions" : `${role.permCount} permissions`}
              </div>
            </div>
          ))}
        </div>

        {/* Interactive matrix */}
        <PermMatrixClient
          roles={matrix.roles}
          groups={matrix.groups}
          granted={matrix.granted}
        />
      </div>
    </>
  );
}
