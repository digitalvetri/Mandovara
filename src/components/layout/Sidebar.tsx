"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard, UserPlus, Users, FileText, Package, Truck,
  Boxes, MapPin, Briefcase, Wrench, Receipt, Wallet,
  CalendarCheck, IndianRupee, ShieldCheck, LogOut,
  Ruler, BarChart2,
  type LucideIcon,
} from "lucide-react";
import { devLogout } from "@/lib/dev-auth";
import { MandovaraLeafIcon } from "./GlobalTopbar";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  // Permission key from /kernel/rbac/permissions that gates this nav item.
  // Absent = shown to all authenticated users.
  perm?: string;
}

const NAV: readonly { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { label: "Owner Dashboard", href: "/",         icon: LayoutDashboard },   // always shown; label swapped at render
      { label: "Projects",        href: "/projects", icon: Briefcase,       perm: "project.view" },
    ],
  },
  {
    section: "Revenue",
    items: [
      { label: "Lead Management",  href: "/leads",      icon: UserPlus,  perm: "lead.view"       },
      { label: "Client 360",       href: "/clients",    icon: Users,     perm: "client.view"     },
      { label: "Quotations (BOQ)", href: "/quotations", icon: FileText,  perm: "quotation.view"  },
    ],
  },
  {
    section: "Catalog & Stock",
    items: [
      { label: "Product Catalog",    href: "/products",  icon: Package, perm: "catalog.view"    },
      { label: "Purchase & Vendors", href: "/purchase",  icon: Truck,   perm: "po.view"         },
      { label: "Stocks",             href: "/inventory", icon: Boxes,   perm: "inventory.view"  },
    ],
  },
  {
    section: "Delivery",
    items: [
      { label: "Site Visit Management", href: "/site-visits",  icon: MapPin,  perm: "sitelog.view"     },
      { label: "Measurements",          href: "/measurements", icon: Ruler,   perm: "measurement.view" },
      { label: "Installation",          href: "/install",      icon: Wrench,  perm: "install.view"     },
    ],
  },
  {
    section: "Money",
    items: [
      // invoice.create rather than invoice.view — DESIGNER has view-only but not the Invoicing module
      { label: "Invoicing & GST",     href: "/invoicing", icon: Receipt, perm: "invoice.create" },
      { label: "Accounts & Payments", href: "/accounts",  icon: Wallet,  perm: "advance.view"   },
    ],
  },
  {
    section: "People",
    items: [
      { label: "Attendance & Leave", href: "/attendance", icon: CalendarCheck },          // all roles
      { label: "Payroll",            href: "/payroll",    icon: IndianRupee,  perm: "payroll.view" },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Reports",       href: "/reports", icon: BarChart2,  perm: "report.view.dashboard" },
      { label: "Admin & Roles", href: "/admin",   icon: ShieldCheck, perm: "admin.settings"       },
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

interface SidebarProps {
  userName: string;
  userRole: string;
  permissions: string[];
}

export function Sidebar({ userName, userRole, permissions }: SidebarProps) {
  const isOwner = permissions.includes("admin.settings");
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
        {NAV.map((section) => {
          const visible = section.items.filter(
            (item) => !item.perm || permissions.includes(item.perm),
          );
          if (visible.length === 0) return null;
          return (
            <div key={section.section} className="mb-4">
              <div className="px-3 mb-1.5 mt-2 text-[10.5px] uppercase tracking-[0.22em] text-sidebar-dim">
                {section.section}
              </div>
              {visible.map((item) => {
                const label =
                  item.href === "/" ? (isOwner ? "Owner Dashboard" : "My Dashboard") : item.label;
                return (
                  <NavRow
                    key={item.href}
                    href={item.href}
                    label={label}
                    Icon={item.icon}
                    active={pathname === item.href}
                  />
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Profile + sign-out */}
      <div className="border-t border-white/[0.08] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-accent/85 text-[#0B1020] flex items-center justify-center text-[12px] font-semibold tracking-wider shrink-0">
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
      {/* Always rendered — opacity swap avoids server/client child-count mismatch */}
      <span
        aria-hidden
        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
        style={{ background: "#2BA89A" }}
      />
      <Icon size={17} strokeWidth={1.6} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
