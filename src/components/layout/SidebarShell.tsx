"use client";

// Client wrapper that gives the Sidebar its responsive behaviour: fixed
// on ≥ md, off-canvas drawer with a hamburger toggle on < md. Closes on
// route change and on Escape.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function SidebarShell() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className="md:hidden fixed inset-x-0 top-0 z-40 h-[52px] bg-sidebar text-sidebar-text flex items-center justify-between px-4 border-b border-white/5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="h-[36px] w-[36px] grid place-items-center rounded-[6px] text-sidebar-text hover:bg-sidebar-hover transition-colors"
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>
        <div className="font-display text-[15px] tracking-[0.24em] font-semibold">
          MANDOVARA
        </div>
        <div className="w-[36px]" />
      </div>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity"
          aria-hidden
        />
      )}

      {/* Drawer / desktop sidebar */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 w-[260px] transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0 md:w-[240px]",
        ].join(" ")}
      >
        {/* Close button on mobile */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="md:hidden absolute top-3 right-3 z-10 h-[32px] w-[32px] grid place-items-center rounded-[6px] text-sidebar-text hover:bg-sidebar-hover transition-colors"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
        <Sidebar />
      </div>
    </>
  );
}
