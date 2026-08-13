"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard, UserPlus, Users, FileText, Package, Truck,
  Boxes, Send, Briefcase, Scissors, Wrench, Receipt, Wallet,
  CalendarCheck, IndianRupee, MessageSquare, ShieldCheck, LogOut,
  Ruler,
  type LucideIcon,
} from "lucide-react";
import { devLogout } from "@/lib/dev-auth";
import { MandovaraLeafIcon } from "./GlobalTopbar";

interface NavItem { label: string; href: string; icon: LucideIcon }

const NAV: readonly { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ label: "Owner Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    section: "Revenue",
    items: [
      { label: "Lead Management",  href: "/leads",      icon: UserPlus },
      { label: "Client 360",       href: "/clients",    icon: Users },
      { label: "Quotations (BOQ)", href: "/quotations", icon: FileText },
    ],
  },
  {
    section: "Catalog & Stock",
    items: [
      { label: "Product Catalog",    href: "/products",            icon: Package },
      { label: "Purchase & Vendors", href: "/purchase",            icon: Truck   },
      { label: "Allocate Stock",     href: "/purchase/allocation", icon: Boxes   },
      { label: "Stock & Dye Lots",   href: "/inventory",           icon: Boxes   },
    ],
  },
  {
    section: "Delivery",
    items: [
      { label: "Sales Orders & Dispatch", href: "/orders",       icon: Send      },
      { label: "Project Pipeline",        href: "/projects",     icon: Briefcase },
      { label: "Measurements",            href: "/measurements", icon: Ruler     },
      { label: "Make (Cut & Stitch)",     href: "/make",         icon: Scissors  },
      { label: "Installation",            href: "/install",      icon: Wrench    },
    ],
  },
  {
    section: "Money",
    items: [
      { label: "Invoicing & GST",     href: "/invoicing", icon: Receipt },
      { label: "Accounts & Payments", href: "/accounts",  icon: Wallet  },
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
      { label: "WhatsApp Automation", href: "/whatsapp", icon: MessageSquare },
      { label: "Admin & Roles",       href: "/admin",    icon: ShieldCheck   },
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
}

export function Sidebar({ userName, userRole }: SidebarProps) {
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
        {NAV.map((section) => (
          <div key={section.section} className="mb-3">
            <div className="px-3 mb-1 mt-2 text-[9.5px] uppercase tracking-[0.22em] text-sidebar-dim">
              {section.section}
            </div>
            {section.items.map((item) => (
              <NavRow
                key={item.href}
                href={item.href}
                label={item.label}
                Icon={item.icon}
                active={pathname === item.href}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Profile + sign-out */}
      <div className="border-t border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-accent/85 text-[#0B1020] flex items-center justify-center text-[11px] font-semibold tracking-wider shrink-0">
            {initials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium truncate text-sidebar-text">
              {userName}
            </div>
            <div className="text-[10.5px] text-sidebar-dim truncate">
              {ROLE_LABEL[userRole] ?? userRole}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signing}
            title="Sign out"
            className="h-7 w-7 rounded-[6px] flex items-center justify-center text-sidebar-dim hover:text-sidebar-text hover:bg-sidebar-hover transition-colors shrink-0 disabled:opacity-40"
          >
            <LogOut size={14} strokeWidth={1.7} />
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
        "relative flex items-center gap-3 h-[32px] px-3 rounded-[6px]",
        "text-[12.5px] transition-colors",
        active
          ? "bg-sidebar-hover text-sidebar-text"
          : "text-sidebar-dim hover:bg-sidebar-hover hover:text-sidebar-text",
      ].join(" ")}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
          style={{ background: "#2BA89A" }}
        />
      )}
      <Icon size={15} strokeWidth={1.6} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
