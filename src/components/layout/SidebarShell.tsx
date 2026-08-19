"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { GlobalTopbar } from "./GlobalTopbar";

interface Props {
  userName: string;
  userRole: string;
  userPermissions: string[];
}

export function SidebarShell({ userName, userRole, userPermissions }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar when route changes (mobile nav click)
  useEffect(() => setOpen(false), [pathname]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* ── Full-width fixed topbar (replaces the old mobile-only strip) ── */}
      <GlobalTopbar
        userName={userName}
        userRole={userRole}
        onMenuOpen={() => setOpen(true)}
      />

      {/* ── Mobile overlay backdrop ── */}
      {open && (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity"
          aria-hidden
        />
      )}

      {/* ── Sidebar panel ── */}
      <div
        className={[
          "fixed left-0 bottom-0 z-50 transition-transform duration-200 ease-in-out",
          // Mobile: 288px drawer, full height, slides in/out
          "top-0 w-[288px]",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible below the 68px topbar; width from --sidebar-w
          "md:top-[68px] md:translate-x-0",
        ].join(" ")}
        style={{ ["--desktop-w" as string]: "var(--sidebar-w)" }}
      >
        <div className="md:w-[var(--sidebar-w)] h-full w-full">
          {/* Mobile close button inside the drawer */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="md:hidden absolute top-3.5 right-3.5 z-10 h-9 w-9 grid place-items-center rounded-[8px] text-sidebar-dim hover:text-sidebar-text hover:bg-sidebar-hover transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>

          <Sidebar userName={userName} userRole={userRole} permissions={userPermissions} isOwner={userRole === "OWNER"} />
        </div>
      </div>
    </>
  );
}
