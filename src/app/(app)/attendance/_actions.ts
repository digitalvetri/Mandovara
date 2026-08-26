"use server";

import { revalidatePath } from "next/cache";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

export interface CheckResult {
  ok: boolean;
  time?: string;    // IST-formatted recorded time, e.g. "09:12 AM"
  worked?: string;  // total worked duration, check-out only, e.g. "8h 02m"
  error?: string;
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

// Check the caller's GPS against the org's configured geofence (first
// Branch with lat/lng/radius set). Returns null if allowed, or an error
// message if outside the fence. Returns null if no fence is configured
// (legacy behaviour — attendance still works on branches without a fence).
async function geofenceError(
  ctx:  Awaited<ReturnType<typeof devContext>>,
  geo:  GeoCoords | undefined,
): Promise<string | null> {
  const db = scoped(ctx);
  const branch = await db.branch.findFirst({
    where:  { latitude: { not: null }, longitude: { not: null }, attendanceRadiusM: { not: null } },
    select: { name: true, latitude: true, longitude: true, attendanceRadiusM: true },
  });
  if (!branch || branch.latitude == null || branch.longitude == null || branch.attendanceRadiusM == null) {
    return null;
  }
  if (!geo) {
    return `Location required — ${branch.name} has a check-in fence configured. Enable location and try again.`;
  }
  const target = { lat: Number(branch.latitude), lng: Number(branch.longitude) };
  const dist = distanceM(geo, target);
  if (dist <= branch.attendanceRadiusM) return null;
  const distM = Math.round(dist);
  return `You are ${distM}m from ${branch.name} (allowed radius ${branch.attendanceRadiusM}m). Move closer to check in / out.`;
}

// ── Check In ───────────────────────────────────────────────────────────────────
// Creates the attendance record for today. Idempotent: returns a clear error
// if already checked in rather than overwriting the original time.

export async function selfCheckIn(geo?: GeoCoords): Promise<CheckResult> {
  const ctx = await devContext();
  const db  = scoped(ctx);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true },
  });
  if (!employee) {
    return { ok: false, error: "No employee profile is linked to your account." };
  }

  const fenceErr = await geofenceError(ctx, geo);
  if (fenceErr) return { ok: false, error: fenceErr };

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
    },
    update: {
      status: "PRESENT",
      inAt:   now,
      inLat:  geo?.lat ?? null,
      inLng:  geo?.lng ?? null,
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

export async function selfCheckOut(geo?: GeoCoords): Promise<CheckResult> {
  const ctx = await devContext();
  const db  = scoped(ctx);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true },
  });
  if (!employee) {
    return { ok: false, error: "No employee profile is linked to your account." };
  }

  const fenceErr = await geofenceError(ctx, geo);
  if (fenceErr) return { ok: false, error: fenceErr };

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
      outAt:   now,
      outLat:  geo?.lat ?? null,
      outLng:  geo?.lng ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/attendance");
  revalidatePath("/employee");
  return { ok: true, time: fmtIST(now), worked: workedStr(existing.inAt, now) };
}
