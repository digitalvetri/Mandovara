import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarShell } from "@/components/layout/SidebarShell";
import { devContext } from "@/lib/dev-context";
import { prisma } from "@/kernel/db/client";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Gate: must be logged in with a valid signed session
  const jar = await cookies();
  const uid = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!uid) redirect("/login");

  // Current user for sidebar display + mustChangePassword gate
  const ctx = await devContext();
  let userName = "User";
  let userRole = ctx.roles[0] ?? "STAFF";

  try {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, role: true, mustChangePassword: true },
    });
    if (user) {
      // Force password rotation before the user can access any app route.
      if (user.mustChangePassword) redirect("/change-password?forced=1");
      userName = user.name;
      userRole = user.role;
    }
  } catch {
    // DB unavailable — use stubs
  }

  const userPermissions = Array.from(ctx.permissions) as string[];

  return (
    <div className="min-h-screen">
      <SidebarShell userName={userName} userRole={userRole} userPermissions={userPermissions} />
      <main className="md:pl-[264px] pt-[68px]">
        <div className="w-full px-5 sm:px-7 md:px-9 xl:px-11 py-4">{children}</div>
      </main>
    </div>
  );
}
