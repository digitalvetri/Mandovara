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
          // Desktop: always visible below the topbar; width from --sidebar-w
          "md:top-[var(--topbar-h)] md:translate-x-0",
        ].join(" ")}
        // Desktop sits below the bar, so it reads the same --topbar-h the bar
        // and <main> use. On mobile the drawer covers the full height, which
        // means its own contents start under the status bar — hence the top
        // padding. Both collapse to today's values off a notched device.
        style={{
          ["--desktop-w" as string]: "var(--sidebar-w)",
          paddingTop: "var(--safe-top)",
        }}
      >
        <div className="md:w-[var(--sidebar-w)] h-full w-full">
          {/* Mobile close button inside the drawer */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            // Absolute children resolve against the padding box, so the
            // drawer's own top padding does not move this — it needs the
            // status-bar inset applied directly or it sits under the clock.
            className="md:hidden absolute top-[calc(0.875rem+var(--safe-top))] right-3.5 z-10 h-9 w-9 grid place-items-center rounded-[8px] text-sidebar-dim hover:text-sidebar-text hover:bg-sidebar-hover transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>

          <Sidebar userName={userName} userRole={userRole} permissions={userPermissions} isOwner={userRole === "OWNER"} />
        </div>
      </div>
    </>
  );
}
