"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { GlobalTopbar } from "./GlobalTopbar";

interface Props {
  userName: string;
  userRole: string;
}

export function SidebarShell({ userName, userRole }: Props) {
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
          // Shared: fixed, left edge, full bottom
          "fixed left-0 bottom-0 z-50 transition-transform duration-200 ease-in-out",
          // Mobile: full height from top, 260px wide, slides in/out
          "top-0 w-[272px]",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible, starts below the 60px global topbar
          "md:top-[60px] md:w-[240px] md:translate-x-0",
        ].join(" ")}
      >
        {/* Mobile close button inside the drawer */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation menu"
          className="md:hidden absolute top-3 right-3 z-10 h-8 w-8 grid place-items-center rounded-[7px] transition-colors"
          style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)" }}
        >
          <X size={15} strokeWidth={2} />
        </button>

        <Sidebar userName={userName} userRole={userRole} />
      </div>
    </>
  );
}
