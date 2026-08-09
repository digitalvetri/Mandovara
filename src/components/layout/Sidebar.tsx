"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Ruler,
  FileText,
  Package,
  Truck,
  Layers,
  Boxes,
  Send,
  Briefcase,
  Wrench,
  Scissors,
  Receipt,
  Wallet,
  CalendarCheck,
  IndianRupee,
  MessageSquare,
  ShieldCheck,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

// Sidebar — MANDOVARA / STUDIO CONSOLE brand block, sections
// (OVERVIEW, REVENUE, CATALOG & STOCK, DELIVERY, MONEY, PEOPLE, SYSTEM),
// one icon per row, gold left-indicator on active row.

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV: readonly { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ label: "Owner Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    section: "Revenue",
    items: [
      { label: "Lead Management",   href: "/leads",      icon: UserPlus },
      { label: "Client 360",        href: "/clients",    icon: Users },
      { label: "Material Estimator", href: "/measure",    icon: Ruler },
      { label: "Quotations (BOQ)",  href: "/quotations", icon: FileText },
    ],
  },
  {
    section: "Catalog & Stock",
    items: [
      { label: "Product Catalog",    href: "/products",  icon: Package },
      { label: "Purchase & Vendors", href: "/purchase",  icon: Truck },
      { label: "Dye-lot Allocation", href: "/purchase/allocation", icon: Layers },
      { label: "Inventory & Stock",  href: "/inventory", icon: Boxes },
    ],
  },
  {
    section: "Delivery",
    items: [
      { label: "Sales Orders & Dispatch", href: "/orders",        icon: Send },
      { label: "Make (Cut & Stitch)",     href: "/make",          icon: Scissors },
      { label: "Install Visits",          href: "/install",       icon: Wrench },
      { label: "Project Pipeline",        href: "/projects",      icon: Briefcase },
      { label: "Site Schedule",           href: "/installations", icon: CalendarCheck },
    ],
  },
  {
    section: "Money",
    items: [
      { label: "Invoicing & GST",     href: "/invoicing", icon: Receipt },
      { label: "Accounts & Payments", href: "/accounts",  icon: Wallet },
    ],
  },
  {
    section: "People",
    items: [
      { label: "Attendance & Leave", href: "/attendance", icon: CalendarCheck },
      { label: "Payroll",            href: "/payroll",    icon: IndianRupee },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Reports",             href: "/reports",  icon: BarChart3 },
      { label: "WhatsApp Automation", href: "/whatsapp", icon: MessageSquare },
      { label: "Admin & Roles",       href: "/admin",    icon: ShieldCheck },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-full w-full bg-sidebar text-sidebar-text flex flex-col">
      {/* Brand */}
      <div className="px-6 pt-5 pb-5">
        <div className="font-display text-[20px] tracking-[0.18em] font-semibold leading-none">
          MANDOVARA
        </div>
        <div className="mt-1.5 text-[9.5px] tracking-[0.28em] text-sidebar-dim uppercase">
          Studio Console
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {NAV.map((section) => (
          <div key={section.section} className="mb-3">
            <div className="px-3 mb-1 mt-2 text-[9.5px] uppercase tracking-[0.22em] text-sidebar-dim">
              {section.section}
            </div>
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <NavRow
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.icon}
                  active={active}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {/* ⌘K discovery hint — the palette itself is mounted globally in the app layout */}
      <div className="px-4 pt-3 pb-1 border-t border-white/[0.08] flex items-center justify-between text-[10.5px] text-sidebar-dim">
        <span>Jump to anything</span>
        <kbd className="tabular text-[10px] px-1.5 py-0.5 rounded-[4px] bg-white/[0.06] border border-white/[0.08]">
          Ctrl K
        </kbd>
      </div>

      {/* Profile block */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-accent/85 text-white flex items-center justify-center text-[11px] font-medium tracking-wider">
          AK
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium truncate text-sidebar-text">
            Arham Kumar
          </div>
          <div className="text-[10.5px] text-sidebar-dim truncate">
            Studio Owner
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavRow({
  href, label, Icon, active,
}: { href: string; label: string; Icon: LucideIcon; active: boolean }) {
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
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-accent"
        />
      )}
      <Icon size={15} strokeWidth={1.6} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
