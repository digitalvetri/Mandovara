import { notFound } from "next/navigation";
import {
  Phone, Mail, Briefcase, Calendar, Hash,
  Building2, ShieldCheck, UserCircle, Clock,
} from "lucide-react";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { prisma } from "@/kernel/db/client";
import { Topbar } from "@/components/layout/Topbar";

export const dynamic = "force-dynamic";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });
}
function fmtDateShort(d: Date) {
  return d.toLocaleDateString("en-IN", {
    month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

// ── Label maps ────────────────────────────────────────────────────────────────

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

const DEPT_LABEL: Record<string, string> = {
  SALES:    "Sales",
  DESIGN:   "Design",
  MEASURE:  "Measurement",
  STORE:    "Store",
  MAKE:     "Make / Stitching",
  INSTALL:  "Installation",
  ACCOUNTS: "Accounts",
  HR:       "HR & Admin",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProfilePage() {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const [user, employee] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: ctx.userId },
      select: { name: true, mobile: true, email: true, role: true, createdAt: true },
    }),
    db.employee.findUnique({
      where:  { userId: ctx.userId },
      select: {
        id: true, code: true, name: true, mobile: true,
        designation: true, department: true, doj: true, status: true,
      },
    }),
  ]);

  if (!user) notFound();

  const displayName = employee?.name ?? user.name;
  const initials    = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const isActive    = employee?.status === "ACTIVE";
  const roleLabel   = ROLE_LABEL[user.role] ?? user.role;
  const deptLabel   = employee ? (DEPT_LABEL[employee.department] ?? employee.department) : null;

  return (
    <>
      <Topbar title="My Profile" />

      {/* ── HERO CARD ─────────────────────────────────────────────────────── */}
      <div className="rounded-[16px] border border-border bg-surface mb-5 overflow-hidden">
        {/* Top accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-gold/60 via-gold/30 to-transparent" />

        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

            {/* Avatar */}
            <div className="h-[72px] w-[72px] rounded-full bg-gold/15 border-2 border-gold/30 flex items-center justify-center shrink-0">
              <span className="font-display text-[26px] font-semibold text-gold leading-none">
                {initials}
              </span>
            </div>

            {/* Identity — grows to fill */}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.015em] text-text">
                {displayName}
              </h1>

              {employee && (
                <p className="mt-1 text-[13.5px] text-text-muted">
                  {employee.designation
                    ? employee.designation
                    : deptLabel}
                  <span className="mx-2 opacity-30">·</span>
                  <span className="font-data text-[12.5px] text-text-subtle">
                    {employee.code}
                  </span>
                </p>
              )}

              {/* Badges */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-border bg-surface-2 text-[11px] font-medium text-text-muted">
                  {roleLabel}
                </span>
                {deptLabel && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-[11px] font-medium text-gold">
                    {deptLabel}
                  </span>
                )}
                {employee && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    isActive
                      ? "bg-solid/10 border border-solid/20 text-solid"
                      : "bg-fault/10 border border-fault/20 text-fault"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-solid" : "bg-fault"}`} />
                    {isActive ? "Active" : "Suspended"}
                  </span>
                )}
              </div>
            </div>

            {/* Right meta — desktop only */}
            <div className="hidden md:flex flex-col items-end gap-1.5 shrink-0 text-right">
              {employee && (
                <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                  <Calendar size={12} strokeWidth={1.8} className="text-gold" />
                  Joined {fmtDateShort(employee.doj)}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[12px] text-text-subtle">
                <Clock size={12} strokeWidth={1.8} />
                Member since {fmtDateShort(user.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── DETAIL GRID ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">

        {/* Left column: Contact + Account */}
        <div className="space-y-4">

          {/* Contact Information */}
          <Card title="Contact Information" icon={<Phone size={13} />}>
            <FieldRow
              icon={<Phone size={13} strokeWidth={1.8} />}
              label="Mobile"
              value={employee?.mobile ?? user.mobile}
            />
            {user.email ? (
              <FieldRow
                icon={<Mail size={13} strokeWidth={1.8} />}
                label="Email"
                value={user.email}
              />
            ) : (
              <FieldRow
                icon={<Mail size={13} strokeWidth={1.8} />}
                label="Email"
                value="Not set"
                muted
              />
            )}
          </Card>

          {/* Account Information */}
          <Card title="Account Information" icon={<ShieldCheck size={13} />}>
            <FieldRow
              icon={<UserCircle size={13} strokeWidth={1.8} />}
              label="User ID"
              value={ctx.userId}
              mono
            />
            <FieldRow
              icon={<ShieldCheck size={13} strokeWidth={1.8} />}
              label="Role"
              value={roleLabel}
            />
            <FieldRow
              icon={<Clock size={13} strokeWidth={1.8} />}
              label="Member since"
              value={fmtDate(user.createdAt)}
            />
          </Card>
        </div>

        {/* Right column: Employment Details */}
        {employee ? (
          <Card title="Employment Details" icon={<Briefcase size={13} />}>
            <FieldRow
              icon={<Hash size={13} strokeWidth={1.8} />}
              label="Employee Code"
              value={employee.code}
              mono
            />
            <FieldRow
              icon={<Building2 size={13} strokeWidth={1.8} />}
              label="Department"
              value={deptLabel ?? "—"}
            />
            {employee.designation && (
              <FieldRow
                icon={<Briefcase size={13} strokeWidth={1.8} />}
                label="Designation"
                value={employee.designation}
              />
            )}
            <FieldRow
              icon={<Calendar size={13} strokeWidth={1.8} />}
              label="Date of Joining"
              value={fmtDate(employee.doj)}
            />
            <FieldRow
              icon={<Phone size={13} strokeWidth={1.8} />}
              label="Work Mobile"
              value={employee.mobile}
            />
            <FieldRow
              icon={<ShieldCheck size={13} strokeWidth={1.8} />}
              label="Status"
              value={isActive ? "Active" : "Suspended"}
              valueClass={isActive ? "text-solid font-semibold" : "text-fault font-semibold"}
            />
          </Card>
        ) : (
          <Card title="Employment Details" icon={<Briefcase size={13} />}>
            <div className="px-5 py-8 text-center text-[13px] text-text-muted">
              No employee record linked to this account.
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({
  title, children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-surface overflow-hidden h-fit">
      <div className="px-5 py-3 border-b border-border/60">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {title}
        </span>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

function FieldRow({
  icon, label, value, mono = false, muted = false, valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_2fr] items-center gap-3 px-5 py-3">
      {/* Icon */}
      <span className="text-text-subtle shrink-0">{icon}</span>
      {/* Label */}
      <span className="text-[12px] text-text-muted">{label}</span>
      {/* Value */}
      <span className={[
        "text-[13px] min-w-0 truncate text-right",
        mono ? "font-data text-[12px] text-text-subtle" : muted ? "text-text-muted italic" : "text-text",
        valueClass ?? "",
      ].join(" ")}>
        {value}
      </span>
    </div>
  );
}
