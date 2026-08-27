"use server";

import { revalidatePath } from "next/cache";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

export interface CheckResult {
  ok: boolean;
  time?: string;    // IST-formatted recorded time, e.g. "09:12 AM"
  worked?: string;  // total worked duration, check-out only, e.g. "8h 02m"
  error?: string;
  /**
   * The caller is outside the office fence and has not said where they
   * are. The UI asks, then calls again with `place` set. This is not an
   * error — the punch is perfectly valid once we know the location.
   */
  needsPlace?: boolean;
  /** How far outside the fence, for the prompt's wording. */
  distanceM?: number;
  branchName?: string;
}

export type GeoCoords = { lat: number; lng: number };

function fmtIST(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function workedStr(inAt: Date, outAt: Date): string {
  const mins = Math.max(0, Math.floor((outAt.getTime() - inAt.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// Haversine — great-circle distance between two points in metres. Good
// enough for a geofence check at office-radius scale (metres, not km).
function distanceM(a: GeoCoords, b: { lat: number; lng: number }): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Where is the caller, relative to the office fence?
//
// Changed 2026-08-27 from a gate to a label (owner instruction). It used
// to return an error string and the punch was refused. For a business
// whose staff are at client sites most of the day, refusing the punch
// only means the day goes unrecorded — the employee still worked.
//
// Now it classifies: inside the fence, outside it, or no fence
// configured. The caller decides what to do, and what it does is ask
// where they are rather than say no.
type FenceVerdict =
  | { kind: "inside" }
  | { kind: "no-fence" }
  | { kind: "outside"; distanceM: number; branchName: string };

async function checkFence(
  ctx:  Awaited<ReturnType<typeof devContext>>,
  geo:  GeoCoords | undefined,
): Promise<FenceVerdict> {
  const db = scoped(ctx);
  const branch = await db.branch.findFirst({
    where:  { latitude: { not: null }, longitude: { not: null }, attendanceRadiusM: { not: null } },
    select: { name: true, latitude: true, longitude: true, attendanceRadiusM: true },
  });
  if (!branch || branch.latitude == null || branch.longitude == null || branch.attendanceRadiusM == null) {
    return { kind: "no-fence" };
  }
  // No GPS is treated as off-site rather than as a failure. A denied
  // location permission, an indoor fix that never arrives, an old
  // handset — none of those mean the person is not at work, and all of
  // them used to block the punch entirely.
  if (!geo) {
    return { kind: "outside", distanceM: 0, branchName: branch.name };
  }
  const target = { lat: Number(branch.latitude), lng: Number(branch.longitude) };
  const dist = distanceM(geo, target);
  if (dist <= branch.attendanceRadiusM) return { kind: "inside" };
  return { kind: "outside", distanceM: Math.round(dist), branchName: branch.name };
}

// ── Check In ───────────────────────────────────────────────────────────────────
// Creates the attendance record for today. Idempotent: returns a clear error
// if already checked in rather than overwriting the original time.

export async function selfCheckIn(geo?: GeoCoords, place?: string): Promise<CheckResult> {
  const ctx = await devContext();
  const db  = scoped(ctx);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true },
  });
  if (!employee) {
    return {
      ok: false,
      error: "No staff record is linked to your login yet. Ask your administrator to open Admin and run \u2018Link staff records\u2019.",
    };
  }

  // Outside the fence? Ask where they are, then accept the punch.
  const fence = await checkFence(ctx, geo);
  const trimmedPlace = place?.trim() ?? "";
  if (fence.kind === "outside" && trimmedPlace.length < 3) {
    return {
      ok: false,
      needsPlace: true,
      distanceM:  fence.distanceM,
      branchName: fence.branchName,
    };
  }
  const offSite = fence.kind === "outside";

  const existing = await db.attendance.findUnique({
    where:  { employeeId_date: { employeeId: employee.id, date: today } },
    select: { inAt: true, lockedAt: true },
  });

  if (existing?.lockedAt) {
    return { ok: false, error: "Today's attendance is locked and cannot be edited." };
  }
  if (existing?.inAt) {
    return {
      ok: false,
      error: `Already checked in at ${fmtIST(existing.inAt)}. Refresh the page if the button is still showing.`,
    };
  }

  await db.attendance.upsert({
    where:  { employeeId_date: { employeeId: employee.id, date: today } },
    create: {
      organizationId: ctx.orgId,
      employeeId:     employee.id,
      date:           today,
      status:         "PRESENT",
      inAt:           now,
      inLat:          geo?.lat ?? null,
      inLng:          geo?.lng ?? null,
      inOffSite:      offSite,
      inPlace:        offSite ? trimmedPlace : null,
    },
    update: {
      status:    "PRESENT",
      inAt:      now,
      inLat:     geo?.lat ?? null,
      inLng:     geo?.lng ?? null,
      inOffSite: offSite,
      inPlace:   offSite ? trimmedPlace : null,
    },
    select: { id: true },
  });

  revalidatePath("/attendance");
  revalidatePath("/employee");
  return { ok: true, time: fmtIST(now) };
}

// ── Check Out ──────────────────────────────────────────────────────────────────
// Records outAt for today. Returns error if no check-in exists or already
// checked out. Calculates and returns total worked duration.

export async function selfCheckOut(geo?: GeoCoords, place?: string): Promise<CheckResult> {
  const ctx = await devContext();
  const db  = scoped(ctx);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true },
  });
  if (!employee) {
    return {
      ok: false,
      error: "No staff record is linked to your login yet. Ask your administrator to open Admin and run \u2018Link staff records\u2019.",
    };
  }

  // Same treatment as check-in: away from the office is a fact to record,
  // not a reason to refuse. Someone who finishes at a client site must be
  // able to close their day from there.
  const fence = await checkFence(ctx, geo);
  const trimmedPlace = place?.trim() ?? "";
  if (fence.kind === "outside" && trimmedPlace.length < 3) {
    return {
      ok: false,
      needsPlace: true,
      distanceM:  fence.distanceM,
      branchName: fence.branchName,
    };
  }
  const offSite = fence.kind === "outside";

  const existing = await db.attendance.findUnique({
    where:  { employeeId_date: { employeeId: employee.id, date: today } },
    select: { inAt: true, outAt: true, lockedAt: true },
  });

  if (existing?.lockedAt) {
    return { ok: false, error: "Today's attendance is locked and cannot be edited." };
  }
  if (!existing?.inAt) {
    return { ok: false, error: "No check-in found for today. Please check in first." };
  }
  if (existing.outAt) {
    return { ok: false, error: `Already checked out at ${fmtIST(existing.outAt)}.` };
  }

  await db.attendance.update({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
    data:  {
      outAt:      now,
      outLat:     geo?.lat ?? null,
      outLng:     geo?.lng ?? null,
      outOffSite: offSite,
      outPlace:   offSite ? trimmedPlace : null,
      // Worked minutes are stored, not recomputed at read time — the
      // payroll month grid sums these, and a stored figure survives an
      // employee's punches being corrected later.
      workedMinutes: existing.inAt
        ? Math.max(0, Math.floor((now.getTime() - existing.inAt.getTime()) / 60000))
        : null,
    },
    select: { id: true },
  });

  revalidatePath("/attendance");
  revalidatePath("/employee");
  return { ok: true, time: fmtIST(now), worked: workedStr(existing.inAt, now) };
}
