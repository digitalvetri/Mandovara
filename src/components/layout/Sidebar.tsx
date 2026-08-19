"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard, UserPlus, Users, FileText, Package, Truck,
  Boxes, MapPin, Briefcase, Wrench, Receipt, Wallet,
  CalendarCheck, IndianRupee, ShieldCheck, LogOut,
  Ruler, BarChart2, CheckSquare, FolderOpen, UserCircle,
  
  Layers,
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
      { label: "Owner Dashboard", href: "/",         icon: LayoutDashboard },
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
      // §0.6 / §15.4 — restoring this was a required handover item.
      { label: "Dye-lot Allocation",href: "/purchase/allocation", icon: Layers },
    ],
  },
  {
    section: "Delivery",
    items: [
      { label: "Site Visit Management", href: "/site-visits",  icon: MapPin  },
      { label: "Measurements",          href: "/measurements", icon: Ruler   },
      { label: "Installation",          href: "/install",      icon: Wrench  },
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

// ── Employee sidebar — exact order from design reference ─────────────────────
const EMPLOYEE_NAV: readonly { section: string; items: readonly NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { label: "My Dashboard", href: "/employee", icon: LayoutDashboard },
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
      { label: "Installation",          href: "/install",      icon: Wrench, perm: "install.view"     },
    ],
  },
  {
    section: "My Work",
    items: [
      { label: "My Tasks", href: "/tasks", icon: CheckSquare },
    ],
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
    section: "Other",
    items: [
    ],
  },
  {
    section: "Admin",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart2 },
    ],
  },
];

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
    <aside className="h-full w-full bg-sidebar text-sidebar-text flex flex-col">
      {/* Brand — mobile drawer only; desktop brand lives in GlobalTopbar */}
      <div className="md:hidden flex items-center gap-3 px-5 pt-5 pb-4 border-b border-sidebar-dim/20">
        <MandovaraLeafIcon size={32} />
        <div>
          <div className="font-display text-[17px] tracking-[0.06em] font-semibold leading-none text-sidebar-text">
            Mandovara
          </div>
          <div className="mt-1 text-[8.5px] tracking-[0.22em] text-sidebar-dim uppercase">
            Studio Console
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {nav.map((section) => {
          const visible = isOwner
            ? section.items
            : section.items.filter((item) => !item.perm || permissions.includes(item.perm));
          if (visible.length === 0) return null;
          return (
            <div key={section.section} className="mb-4">
              <div className="px-3 mb-1.5 mt-2 text-[10.5px] uppercase tracking-[0.22em] text-sidebar-dim">
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

      {/* Profile + sign-out */}
      <div className="border-t border-white/[0.08] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-accent text-white flex items-center justify-center text-[12px] font-semibold tracking-wider shrink-0">
            {initials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-medium truncate text-sidebar-text">
              {userName}
            </div>
            <div className="text-[11px] text-sidebar-dim truncate">
              {ROLE_LABEL[userRole] ?? userRole}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signing}
            title="Sign out"
            className="h-8 w-8 rounded-[7px] flex items-center justify-center text-sidebar-dim hover:text-sidebar-text hover:bg-sidebar-hover transition-colors shrink-0 disabled:opacity-40"
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
      className={[
        "relative flex items-center gap-3 h-[38px] px-3 rounded-[7px]",
        "text-[13.5px] transition-colors",
        active
          ? "bg-sidebar-hover text-sidebar-text"
          : "text-sidebar-dim hover:bg-sidebar-hover hover:text-sidebar-text",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
      />
      <Icon size={17} strokeWidth={1.6} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
