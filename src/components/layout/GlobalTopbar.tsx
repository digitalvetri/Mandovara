"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search, LogOut } from "lucide-react";
import { devLogout } from "@/lib/dev-auth";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

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
  INSTALLER:       "Site Installer",
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

function openSearch() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }),
  );
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
    <header className="fixed inset-x-0 top-0 z-40 h-[60px] flex items-stretch bg-sidebar border-b border-rule">

      {/* ── Brand block — 240px, aligns with the sidebar ── */}
      <div
        className="hidden md:flex items-center gap-3 shrink-0 px-5 border-r border-rule"
        style={{ width: "240px" }}
      >
        <MandovaraLeafIcon size={34} />
        <div>
          <div
            className="text-sidebar-text font-semibold text-[15px] leading-[1.1] tracking-[0.06em]"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            Mandovara
          </div>
          <div className="text-sidebar-dim text-[8.5px] tracking-[0.22em] mt-[3px] uppercase">
            Studio Console
          </div>
        </div>
      </div>

      {/* ── Mobile: hamburger + brand ── */}
      <div className="md:hidden flex items-center gap-3 px-4">
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
          className="text-sidebar-text font-semibold text-[15px] tracking-[0.06em]"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          Mandovara
        </div>
      </div>

      {/* ── Right panel: search + actions + user ── */}
      <div className="flex-1 flex items-center gap-2 px-4 md:px-5 min-w-0">

        {/* Search pill */}
        <button
          type="button"
          onClick={openSearch}
          title="Search — Ctrl K"
          aria-label="Open command palette"
          className="flex items-center gap-2.5 h-[38px] flex-1 max-w-[440px] px-3.5 rounded-[10px] text-left bg-surface border border-rule hover:border-accent/40 transition-all group"
        >
          <Search size={13.5} strokeWidth={1.8} className="shrink-0 text-text-dim" />
          <span className="flex-1 text-[12.5px] text-text-dim truncate">
            Search projects, clients, designs…
          </span>
          <kbd className="hidden sm:inline-flex items-center text-[9.5px] px-1.5 py-[3px] rounded-[5px] text-text-dim bg-surface-2 border border-rule">
            Ctrl K
          </kbd>
        </button>

        <div className="flex-1" />

        {/* Notification bell */}
        <NotificationBell />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Vertical divider */}
        <div className="hidden sm:block w-px h-5 mx-0.5 shrink-0 bg-rule" />

        {/* User chip */}
        <div className="hidden sm:flex items-center gap-2.5 h-[38px] px-3 rounded-[10px] shrink-0 cursor-default bg-surface border border-rule">
          {/* Avatar with gold accent to distinguish from teal CTA */}
          <div
            className="h-[26px] w-[26px] rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ background: "#C9A227" }}
          >
            {ini}
          </div>
          <div className="leading-none hidden lg:block">
            <div className="text-[12px] font-medium text-sidebar-text">
              {userName}
            </div>
            <div className="text-[10px] mt-[2.5px] text-sidebar-dim">
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
          className="h-[38px] w-[38px] grid place-items-center rounded-[8px] text-text-dim hover:text-accent hover:bg-surface transition-colors disabled:opacity-40"
        >
          <LogOut size={15} strokeWidth={1.7} />
        </button>
      </div>
    </header>
  );
}

// ── Actual Mandovara leaf logo — replicates the teal plant icon on mandovara.com
export function MandovaraLeafIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Outer left leaf */}
      <path
        d="M20 36 C 14 26 8 18 11 6 C 17 8 21 20 20 36 Z"
        fill="#2BA89A"
        opacity="0.60"
      />
      {/* Inner left leaf */}
      <path
        d="M20 36 C 17 24 13 16 16 7 C 20 9 21 22 20 36 Z"
        fill="#2BA89A"
        opacity="0.85"
      />
      {/* Center stem / main leaf */}
      <path
        d="M20 36 C 20 24 19 15 20 4 C 21 15 20 24 20 36 Z"
        fill="#2BA89A"
      />
      {/* Inner right leaf */}
      <path
        d="M20 36 C 23 24 27 16 24 7 C 20 9 19 22 20 36 Z"
        fill="#2BA89A"
        opacity="0.85"
      />
      {/* Outer right leaf */}
      <path
        d="M20 36 C 26 26 32 18 29 6 C 23 8 19 20 20 36 Z"
        fill="#2BA89A"
        opacity="0.60"
      />
    </svg>
  );
}
