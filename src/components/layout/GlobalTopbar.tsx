"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Menu, LogOut, CalendarDays } from "lucide-react";
import { devLogout } from "@/lib/dev-auth";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { GlobalSearch } from "@/components/search/GlobalSearch";

interface Props {
  userName: string;
  userRole: string;
  onMenuOpen: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER:           "Studio Owner",
  DESIGNER:        "Interior Designer",
  SALES:           "Sales Executive",
  MEASURE_EXEC:    "Measurement Exec",
  STORE:           "Store Keeper",
  MAKE_SUPERVISOR: "Make Supervisor",
  ACCOUNTS:        "Accounts",
  HR:              "HR Manager",
};

function initials(name: string): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

export function GlobalTopbar({ userName, userRole, onMenuOpen }: Props) {
  const router = useRouter();
  const [signing, startSignOut] = useTransition();
  const ini = initials(userName);

  function handleSignOut() {
    startSignOut(async () => {
      await devLogout();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-[68px] flex items-stretch bg-sidebar">

      {/* ── Brand block — width from --sidebar-w so the vertical seam between
             topbar and sidebar stays perfectly aligned as the rail grows. ── */}
      <div
        className="hidden md:flex items-center gap-3 shrink-0 pl-6 pr-4 border-r border-white/[0.06]"
        style={{ width: "var(--sidebar-w)" }}
      >
        <MandovaraLeafIcon size={40} />
        <div className="min-w-0">
          <div
            className="text-sidebar-text font-semibold text-[17px] leading-[1.05] tracking-[0.04em] truncate"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            Mandovara
          </div>
          <div className="text-sidebar-dim text-[9.5px] tracking-[0.24em] mt-[4px] uppercase">
            Studio Console
          </div>
        </div>
      </div>

      {/* ── Mobile: hamburger + brand ── */}
      <div className="md:hidden flex items-center gap-2 pl-3 pr-1 shrink-0">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Open navigation menu"
          className="h-9 w-9 grid place-items-center rounded-[8px] text-sidebar-dim hover:text-sidebar-text hover:bg-sidebar-hover transition-colors"
        >
          <Menu size={19} strokeWidth={1.75} />
        </button>
        <MandovaraLeafIcon size={28} />
        <div
          className="hidden sm:block text-sidebar-text font-semibold text-[15px] tracking-[0.06em]"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          Mandovara
        </div>
      </div>

      {/* ── Right panel: search + actions + user ── */}
      <div className="flex-1 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 min-w-0">

        {/* Inline global search */}
        <GlobalSearch />

        <div className="flex-1" />

        {/* Notification bell */}
        <NotificationBell />

        {/* Follow-up calendar — hidden on the narrowest screens, where the
            action row would otherwise overflow the viewport. Reachable from
            the sidebar nav on every device. */}
        <Link
          href={"/calendar" as Route}
          title="Follow-up Calendar"
          aria-label="Open follow-up calendar"
          className="hidden sm:grid h-[38px] w-[38px] place-items-center rounded-[8px] border on-chrome"
        >
          <CalendarDays size={16} strokeWidth={1.6} />
        </Link>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Vertical divider */}
        <div className="hidden sm:block w-px h-5 mx-0.5 shrink-0 on-chrome-rule" />

        {/* User chip */}
        <div className="hidden sm:flex items-center gap-2.5 h-[38px] px-3 rounded-[10px] shrink-0 cursor-default border on-chrome">
          {/* Avatar with gold accent to distinguish from teal CTA */}
          <div
            className="h-[26px] w-[26px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-accent-chrome text-ink"
          >
            {ini}
          </div>
          <div className="leading-none hidden lg:block">
            <div className="text-[12px] font-medium on-chrome-text">
              {userName}
            </div>
            <div className="text-[10px] mt-[2.5px] on-chrome-dim">
              {ROLE_LABEL[userRole] ?? userRole}
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signing}
          title="Sign out"
          aria-label="Sign out"
          className="h-[38px] w-[38px] grid place-items-center rounded-[8px] border on-chrome disabled:opacity-40"
        >
          <LogOut size={15} strokeWidth={1.7} />
        </button>
      </div>
    </header>
  );
}

// The actual Mandovara mark — a chromakeyed PNG extracted from the
// owner's brand file (public/mandovara-mark.png, transparent BG).
// See scripts/extract-logo-mark.mts for the extraction pipeline.
// Same API as the previous SVG icon so every caller keeps working.
export function MandovaraLeafIcon({ size = 36 }: { size?: number; colour?: string }) {
  return (
    <img
      src="/mandovara-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
