import { SidebarShell } from "@/components/layout/SidebarShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SidebarShell />
      <main className="md:pl-[240px] pt-[52px] md:pt-0">
        <div className="max-w-[1360px] px-4 sm:px-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
