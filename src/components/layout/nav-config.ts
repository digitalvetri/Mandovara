// The sidebar's two navigation trees.
//
// Lifted out of Sidebar.tsx on 2026-09-04 when adding the Accounts
// role's missing rows pushed that file past the §10 300-line ceiling.
// It is also the better seam: Sidebar.tsx is now purely how a rail is
// drawn, and this is purely what is in it — which is the file anyone
// editing the menu actually wants.
//
// Rows that lead somewhere permission-gated carry a `perm`, and Sidebar
// hides them from anyone who lacks it — so adding one here can never
// expose a page, only a link a user was already allowed to open. Rows
// without one (Dashboard, My Tasks, My Profile, Attendance) go to pages
// every signed-in employee may open.

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, UserPlus, Users, FileText, Package, Truck,
  Boxes, MapPin, Briefcase, Receipt, Wallet,
  CalendarCheck, IndianRupee, ShieldCheck,
  BarChart2, CheckSquare, UserCircle, Ruler, BookOpen, PiggyBank,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  perm?: string;
}

// ── Owner sidebar — exact order from design reference ───────────────────────
export const OWNER_NAV: readonly { section: string; items: readonly NavItem[] }[] = [
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
      { label: "Catalogues",        href: "/catalogues", icon: BookOpen },
      { label: "Product Catalog",   href: "/products",   icon: Package },
      { label: "Purchase & Vendors",href: "/purchase",   icon: Truck   },
      { label: "Stocks",            href: "/inventory",  icon: Boxes   },
    ],
  },
  {
    section: "Delivery",
    items: [
      // One entry, not two. A site visit and the measurement taken on it
      // are the same trip; FieldworkTabs switches between the two views
      // once you're inside. (2026-08-27, owner instruction.)
      { label: "Site Visits & Measurements", href: "/site-visits", icon: MapPin },
    ],
  },
  {
    section: "Money",
    items: [
      { label: "Invoicing & GST",    href: "/invoicing", icon: Receipt },
      { label: "Accounts & Payments",href: "/accounts",  icon: Wallet  },
      // Personal, not the studio's books — see /my-expenses.
      { label: "My Expenses",        href: "/my-expenses", icon: PiggyBank },
    ],
  },
  {
    section: "People",
    items: [
      { label: "Attendance & Leave", href: "/attendance", icon: CalendarCheck },
      // "Leave applications" removed from owner nav 25 Aug 2026 — owner
      // asked for it to appear only for employees (who reach it via
      // Attendance & Leave on their own /employee dashboard). Owner can
      // still open /leave directly if needed; it just isn't cluttering
      // the primary sidebar.
      { label: "Payroll",            href: "/payroll",    icon: IndianRupee   },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Reports",       href: "/reports", icon: BarChart2,   perm: "report.view.sales" },
      { label: "Admin & Roles", href: "/admin",   icon: ShieldCheck },
    ],
  },
];

export const EMPLOYEE_NAV: readonly { section: string; items: readonly NavItem[] }[] = [
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
    section: "Catalog & Stock",
    items: [
      { label: "Catalogues",      href: "/catalogues", icon: BookOpen, perm: "catalog.view" },
      { label: "Product Catalog", href: "/products",   icon: Package,  perm: "catalog.view" },
      // Added 2026-09-04 (owner): the Accounts login pays the vendor
      // bills and carries stock value on the books, but this nav had no
      // row for either module, so the only way in was to type the URL.
      // Perm-gated, so no other role's sidebar changes.
      { label: "Purchase & Vendors", href: "/purchase",  icon: Truck, perm: "po.view"        },
      { label: "Stocks",             href: "/inventory", icon: Boxes, perm: "inventory.view" },
    ],
  },
  {
    section: "Field Operations",
    items: [
      { label: "Site Visit Management", href: "/site-visits",   icon: MapPin, perm: "sitelog.view"        },
      { label: "Measurements",          href: "/measurements",  icon: Ruler,  perm: "measurement.view.own" },
    ],
  },
  {
    section: "Money",
    items: [
      // The Accounts role's own modules. They were missing entirely —
      // an accounts user could open every screen except the two they
      // were hired to work in.
      { label: "Invoicing & GST",     href: "/invoicing", icon: Receipt, perm: "invoice.view" },
      { label: "Accounts & Payments", href: "/accounts",  icon: Wallet,  perm: "expense.view" },
    ],
  },
  {
    section: "My Work",
    items: [
      { label: "My Tasks",    href: "/tasks",       icon: CheckSquare },
      { label: "My Expenses", href: "/my-expenses", icon: PiggyBank },
    ],
  },
  {
    section: "People",
    items: [
      { label: "Attendance & Leave", href: "/attendance", icon: CalendarCheck },
      // Documents was listed here and is hidden until the module is
      // real (owner, 2026-08-29) — an employee following the link landed
      // on an empty placeholder, which reads as a broken app rather than
      // an unfinished one. The route redirects rather than 404s, so an
      // old bookmark still goes somewhere sensible.
      { label: "My Profile",         href: "/profile",    icon: UserCircle    },
    ],
  },
];

export const ROLE_LABEL: Record<string, string> = {
  OWNER:           "Studio Owner",
  DESIGNER:        "Interior Designer",
  SALES:           "Sales Executive",
  MEASURE_EXEC:    "Measurement Exec",
  STORE:           "Store Keeper",
  MAKE_SUPERVISOR: "Make Supervisor",
  ACCOUNTS:        "Accounts",
  HR:              "HR Manager",
};
