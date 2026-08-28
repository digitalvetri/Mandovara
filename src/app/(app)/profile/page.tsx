import { notFound } from "next/navigation";
import {
  Phone, Mail, Briefcase, Calendar, Hash,
  Building2, ShieldCheck, UserCircle, Clock,
} from "lucide-react";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { orgPrisma } from "@/kernel/db/rls";
import { Topbar } from "@/components/layout/Topbar";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { Card, FieldRow } from "./_components/ProfileParts";
import { fmtDate, fmtDateShort, ROLE_LABEL, DEPT_LABEL } from "./_components/profile-labels";
import { EditProfileSheet } from "./_components/EditProfileSheet";
import { AccountSettings } from "./_components/AccountSettings";

export const dynamic = "force-dynamic";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProfilePage() {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const [user, employee] = await Promise.all([
    orgPrisma(ctx.orgId).user.findUnique({
      where:  { id: ctx.userId },
      select: {
        name: true, mobile: true, email: true, role: true, createdAt: true,
        avatarKey: true, notifyPrefs: true, lastLoginAt: true,
      },
    }),
    db.employee.findUnique({
      where:  { userId: ctx.userId },
      select: {
        id: true, code: true, name: true, mobile: true,
        designation: true, department: true, doj: true, status: true,
        emergencyContact: true,
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

  // ── One number, one joining date ──────────────────────────────────
  //
  // The page showed the same mobile twice — "Mobile" under Contact and
  // "Work Mobile" under Employment — and three dates that read as
  // contradictions: "Joined Apr 2025", "Member since Aug 2026" in the
  // hero, and "15 August 2026" under Account. Two of those are the same
  // fact (the account's creation date) shown at two precisions, and the
  // third is a different fact entirely (the HR joining date).
  //
  // Resolved by naming the single source for each: the joining date is
  // Employee.doj and appears once, in Employment Details. The account
  // creation date is not a joining date and no longer competes with one
  // in the hero. The mobile is the employee's where there is an employee
  // record, and it appears once.
  const mobile = employee?.mobile ?? user.mobile;
  const emergency = (employee?.emergencyContact ?? null) as
    { name?: string; mobile?: string; relation?: string } | null;
  const prefs = (user.notifyPrefs ?? null) as { email?: boolean; app?: boolean } | null;
  const roleLabel   = ROLE_LABEL[user.role] ?? user.role;
  const deptLabel   = employee ? (DEPT_LABEL[employee.department] ?? employee.department) : null;

  return (
    <>
      <Topbar title="My Profile" actions={<InstallAppButton />} />

      {/* ── HERO CARD ─────────────────────────────────────────────────────── */}
      <div className="rounded-[16px] border border-border bg-surface mb-5 overflow-hidden">
        {/* Top accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-gold/60 via-gold/30 to-transparent" />

        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

            {/* Avatar */}
            <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border-2 border-gold/30 bg-gold/15">
              {user.avatarKey ? (
                  <img src={user.avatarKey} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center font-display text-[26px] font-semibold leading-none text-gold">
                  {initials}
                </span>
              )}
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

            {/* Right meta + Edit. One date here, not two competing ones. */}
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <EditProfileSheet
                initial={{
                  mobile,
                  email: user.email ?? "",
                  emergencyName:     emergency?.name ?? "",
                  emergencyMobile:   emergency?.mobile ?? "",
                  emergencyRelation: emergency?.relation ?? "",
                  avatarKey: user.avatarKey,
                  hasEmployee: !!employee,
                }}
              />
              {employee && (
                <div className="hidden items-center gap-1.5 text-[12px] text-text-muted md:flex">
                  <Calendar size={12} strokeWidth={1.8} className="text-gold" />
                  Joined {fmtDateShort(employee.doj)}
                </div>
              )}
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
              value={mobile}
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
              label="Account created"
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
              icon={<ShieldCheck size={13} strokeWidth={1.8} />}
              label="Status"
              value={isActive ? "Active" : "Suspended"}
              valueClass={isActive ? "text-solid font-semibold" : "text-fault font-semibold"}
            />
            <FieldRow
              icon={<Phone size={13} strokeWidth={1.8} />}
              label="Emergency contact"
              value={
                emergency?.name || emergency?.mobile
                  ? [emergency.name, emergency.relation ? `(${emergency.relation})` : null, emergency.mobile]
                      .filter(Boolean).join(" ")
                  : "Not set"
              }
              muted={!emergency?.name && !emergency?.mobile}
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

      {/* ── ACCOUNT SETTINGS ──────────────────────────────────────────────── */}
      <div className="pb-8">
        <AccountSettings
          notifyEmail={prefs?.email ?? false}
          notifyApp={prefs?.app ?? true}
          lastLoginAt={user.lastLoginAt ? user.lastLoginAt.toISOString() : null}
          hasEmail={!!user.email}
        />
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
