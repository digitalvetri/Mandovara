import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarShell } from "@/components/layout/SidebarShell";
import { devContext } from "@/lib/dev-context";
import { prisma } from "@/kernel/db/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Gate: must be logged in
  const jar = await cookies();
  if (!jar.has("dev_uid")) redirect("/login");

  // Current user for sidebar display
  const ctx = await devContext();
  let userName = "User";
  let userRole = ctx.roles[0] ?? "STAFF";

  try {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, role: true },
    });
    if (user) {
      userName = user.name;
      userRole = user.role;
    }
  } catch {
    // DB unavailable — use stubs
  }

  return (
    <div className="min-h-screen">
      <SidebarShell userName={userName} userRole={userRole} />
      <main className="md:pl-[240px] pt-[60px]">
        <div className="w-full px-4 sm:px-6 md:px-8 xl:px-10">{children}</div>
      </main>
    </div>
  );
}
