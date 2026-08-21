"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard, UserPlus, Users, FileText, Package, Truck,
  Boxes, MapPin, Briefcase, Receipt, Wallet,
  CalendarCheck, IndianRupee, ShieldCheck, LogOut,
  Ruler, BarChart2, CheckSquare, FolderOpen, UserCircle,
  type LucideIcon,
} from "lucide-react";
import { devLogout } from "@/lib/dev-auth";
import { MandovaraLeafIcon } from "./GlobalTopbar";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  perm?: string;
}

// ── Owner sidebar — exact order from design reference ───────────────────────
const OWNER_NAV: readonly { section: string; items: readonly NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { label: "Dashboard",        href: "/",         icon: LayoutDashboard },
      { label: "Projects",        href: "/projects", icon: Briefcase       },
    ],
  },
  {
    section: "Revenue",
    items: [
      { label: "Lead Management",  href: "/leads",      icon: UserPlus },
      { label: "Client 360",       href: "/clients",    icon: Users    },
      { label: "Quotations (BOQ)", href: "/quotations", icon: FileText },
    ],
  },
  {
    section: "Catalog & Stock",
    items: [
      { label: "Product Catalog",   href: "/products",  icon: Package },
      { label: "Purchase & Vendors",href: "/purchase",  icon: Truck   },
      { label: "Stocks",            href: "/inventory", icon: Boxes   },
    ],
  },
  {
    section: "Delivery",
    items: [
      { label: "Site Visit Management", href: "/site-visits",  icon: MapPin  },
      { label: "Measurements",          href: "/measurements", icon: Ruler   },
    ],
  },
  {
    section: "Money",
    items: [
      { label: "Invoicing & GST",    href: "/invoicing", icon: Receipt },
      { label: "Accounts & Payments",href: "/accounts",  icon: Wallet  },
    ],
  },
  {
    section: "People",
    items: [
      { label: "Attendance & Leave", href: "/attendance", icon: CalendarCheck },
      { label: "Payroll",            href: "/payroll",    icon: IndianRupee   },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Reports",       href: "/reports", icon: BarChart2   },
      { label: "Admin & Roles", href: "/admin",   icon: ShieldCheck },
    ],
  },
];

const EMPLOYEE_NAV: readonly { section: string; items: readonly NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { label: "Dashboard", href: "/employee", icon: LayoutDashboard },
      { label: "Projects",     href: "/projects", icon: Briefcase,       perm: "project.view" },
    ],
  },
  {
    section: "Work",
    items: [
      { label: "Lead Management",  href: "/leads",      icon: UserPlus, perm: "lead.view"      },
      { label: "Client 360",       href: "/clients",    icon: Users,    perm: "client.view"    },
      { label: "Quotations (BOQ)", href: "/quotations", icon: FileText, perm: "quotation.view" },
    ],
  },
  {
    section: "Catalog",
    items: [
      { label: "Product Catalog", href: "/products", icon: Package, perm: "catalog.view" },
    ],
  },
  {
    section: "Field Operations",
    items: [
      { label: "Site Visit Management", href: "/site-visits",  icon: MapPin, perm: "sitelog.view"     },
      { label: "Measurements",          href: "/measurements", icon: Ruler,  perm: "measurement.view" },
    ],
  },
  {
    section: "My Work",
    items: [{ label: "My Tasks", href: "/tasks", icon: CheckSquare }],
  },
  {
    section: "People",
    items: [
      { label: "Attendance & Leave", href: "/attendance", icon: CalendarCheck },
      { label: "Documents",          href: "/documents",  icon: FolderOpen    },
      { label: "My Profile",         href: "/profile",    icon: UserCircle    },
    ],
  },
  {
    section: "Admin",
    items: [{ label: "Reports", href: "/reports", icon: BarChart2, perm: "report.view.sales" as const }],
  },
];

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

function isActive(pathname: string, href: string): boolean {
  if (href === "/" || href === "/employee") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

interface SidebarProps {
  userName: string;
  userRole: string;
  permissions: string[];
  isOwner: boolean;
}

export function Sidebar({ userName, userRole, permissions, isOwner }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const [signing, startSignOut] = useTransition();

  function handleSignOut() {
    startSignOut(async () => {
      await devLogout();
      router.push("/login");
      router.refresh();
    });
  }

  const nav = isOwner ? OWNER_NAV : EMPLOYEE_NAV;

  return (
    // min-h-0 lets flex-1 nav actually shrink instead of forcing its full
    // intrinsic height and bubbling overflow up. Without it, the whole aside
    // grew past the viewport and the nav container's own scrollbar rendered.
    <aside className="relative h-full w-full bg-sidebar text-sidebar-text flex flex-col overflow-hidden min-h-0">
      <div aria-hidden className="pointer-events-none absolute inset-0 chrome-motif" />
      <div aria-hidden className="pointer-events-none absolute inset-0 chrome-veil" />

      {/* Brand — mobile drawer only; desktop brand lives in GlobalTopbar. */}
      <div className="relative z-10 md:hidden flex items-center gap-3 px-6 pt-7 pb-5 border-b border-sidebar-dim/20">
        <MandovaraLeafIcon size={40} />
        <div>
          <div className="font-display text-[19px] tracking-[0.04em] font-semibold leading-none text-sidebar-text">
            Mandovara
          </div>
          <div className="mt-1.5 text-[9.5px] tracking-[0.24em] text-sidebar-dim uppercase">
            Studio Console
          </div>
        </div>
      </div>

      {/* Nav — min-h-0 is essential (see comment on aside). rail-scroll gives
          a hair-thin scrollbar only when short viewports force it. */}
      <nav className="relative z-10 flex-1 min-h-0 overflow-y-auto rail-scroll px-3 py-2">
        {nav.map((section) => {
          const visible = isOwner
            ? section.items
            : section.items.filter((item) => !item.perm || permissions.includes(item.perm));
          if (visible.length === 0) return null;
          return (
            <div key={section.section} className="mb-3 first:mt-1">
              <div className="px-3 mb-1 text-[10px] uppercase tracking-[0.24em] text-sidebar-dim/80">
                {section.section}
              </div>
              {visible.map((item) => (
                <NavRow
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.icon}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Profile + sign-out — mobile drawer only. On desktop the topbar
          already shows the user chip and sign-out, so this block would just
          duplicate and steal ~70px that made the nav scroll. */}
      <div className="relative z-10 md:hidden border-t border-sidebar-dim/15 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-accent-chrome text-ink flex items-center justify-center text-[12px] font-semibold tracking-wider shrink-0">
            {initials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium truncate text-sidebar-text">{userName}</div>
            <div className="text-[11.5px] text-sidebar-dim truncate">
              {ROLE_LABEL[userRole] ?? userRole}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signing}
            title="Sign out"
            className="h-9 w-9 rounded-[8px] flex items-center justify-center text-sidebar-dim hover:text-sidebar-text hover:bg-sidebar-hover transition-colors shrink-0 disabled:opacity-40"
          >
            <LogOut size={15} strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavRow({ href, label, Icon, active }: { href: string; label: string; Icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href as Route}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex items-center gap-3 h-[36px] pl-3.5 pr-3 rounded-[8px] mt-[1px]",
        "text-[13.5px] leading-none transition-colors",
        active
          ? "bg-sidebar-hover text-sidebar-text font-medium"
          : "text-sidebar-dim hover:bg-sidebar-hover/70 hover:text-sidebar-text",
      ].join(" ")}
    >
      {/* Left indicator — a 3px accent bar on the active row. */}
      <span
        aria-hidden
        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent-chrome transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
      />
      <Icon size={17} strokeWidth={active ? 1.9 : 1.6} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
