// AppRole → the Role row that carries its permissions.
//
// The app runs two role systems side by side during the RBAC migration:
// User.role is the legacy AppRole enum, and User.roleId points at a Role
// row whose RolePermission set is what actually gets enforced. A user
// created with only the enum set has no permissions at all.
//
// This mapping lived inside createUser. Adding a login from the employee
// list needed the same lookup, and a second copy of a table like this is
// the kind that drifts — one place gains a role the other does not, and
// the mismatch shows up as a person who can sign in but cannot see
// anything.

/** Role.name as seeded, keyed by the AppRole enum value. */
export const ROLE_NAME_BY_APP_ROLE: Record<string, string> = {
  OWNER:           "Owner",
  DESIGNER:        "Designer",
  SALES:           "Sales",
  MEASURE_EXEC:    "Measure Executive",
  STORE:           "Store",
  MAKE_SUPERVISOR: "Make Supervisor",
  ACCOUNTS:        "Accounts",
  HR:              "HR",
};

interface RoleFinder {
  role: {
    findFirst(args: {
      where:  { organizationId: string; name: string | undefined };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

/**
 * The Role row for an AppRole, or null when the org has not seeded one.
 *
 * Null is not an error: session.ts falls back to allPermissions() for an
 * OWNER whose roleId is null, which is how the bootstrap admin works.
 */
export async function resolveDynamicRoleId(
  db:      RoleFinder,
  orgId:   string,
  appRole: string,
): Promise<string | null> {
  const found = await db.role.findFirst({
    where:  { organizationId: orgId, name: ROLE_NAME_BY_APP_ROLE[appRole] },
    select: { id: true },
  });
  return found?.id ?? null;
}
