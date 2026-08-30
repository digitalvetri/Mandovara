// Is Row-Level Security actually being enforced on the request path?
//
// §3.2 puts FORCE ROW LEVEL SECURITY on every org-owned table, but Postgres
// always bypasses row security for a superuser and for any role with
// BYPASSRLS. So the policies only bite if the application connects as a role
// that is neither — which is what APP_DATABASE_URL and the mandovara_app role
// exist for.
//
// When APP_DATABASE_URL is unset the client falls back to DATABASE_URL, the
// owner connection, and every policy becomes decorative. Nothing breaks;
// nothing looks wrong; tenant isolation is simply not there. The container
// start-up check already warns about this, but it warns to a log nobody reads
// — which is how a production deployment ran without isolation and nobody
// noticed. This is the same fact, asked at request time so it can be shown on
// a screen.
//
// Lives in kernel/db because it needs the raw client to ask which role the
// connection actually authenticated as.

import { prisma } from "./client";

export interface RlsStatus {
  /** True when the connection cannot bypass row security. */
  enforced: boolean;
  /** The Postgres role the app connects as, for the operator to recognise. */
  role:     string | null;
  /** Set when the answer could not be established at all. */
  error?:   string;
}

interface RoleRow { name: string; rolsuper: boolean; rolbypassrls: boolean }

/**
 * Ask the database, not the environment.
 *
 * Reading APP_DATABASE_URL would only tell us what was configured; this tells
 * us what is true, which also catches the case where the variable is set but
 * points at a role that was granted BYPASSRLS anyway.
 */
export async function getRlsStatus(): Promise<RlsStatus> {
  try {
    const rows = await prisma.$queryRawUnsafe<RoleRow[]>(
      `SELECT current_user AS name, rolsuper, rolbypassrls
         FROM pg_roles WHERE rolname = current_user`,
    );
    const role = rows[0];
    if (!role) return { enforced: false, role: null, error: "Could not read the connection's role." };
    return {
      enforced: !role.rolsuper && !role.rolbypassrls,
      role:     role.name,
    };
  } catch (e) {
    return {
      enforced: false,
      role:     null,
      error:    e instanceof Error ? e.message : "Unknown error",
    };
  }
}
