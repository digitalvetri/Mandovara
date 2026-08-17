// Installations console repository.

import { scoped } from "@/kernel/db/scoped";
import type { ProjectStage } from "@prisma/client";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

// Project.stage values that mean "work is in flight" for the install desk.
const IN_FLIGHT_STAGES = [
  "ORDERED", "PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING",
] as ProjectStage[];

// billingAddress is a Json column, not a relation — read the city defensively.
function cityOf(addr: unknown): string | null {
  if (addr && typeof addr === "object" && "city" in addr) {
    const c = (addr as { city?: unknown }).city;
    return typeof c === "string" ? c : null;
  }
  return null;
}

export interface UpcomingMilestone {
  id: string;
  name: string;
  plannedDate: Date;
  billingPct: string;
  status: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  clientName: string;
  clientMobile: string;
  city: string | null;
}

export interface SnagRow {
  id: string;
  location: string | null;   // Snag.roomLabel is nullable
  description: string;
  status: string;
  createdAt: Date;
  projectId: string;
  projectNumber: string;
  projectName: string;
}

export interface InstallationsData {
  windowDays: number;
  upcoming: UpcomingMilestone[];
  snags: SnagRow[];
  activeProjectCount: number;
}

export async function loadInstallations(
  ctx: RequestContext,
  windowDays = 30,
): Promise<InstallationsData> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);

  const now = new Date();
  const horizon = new Date(); horizon.setDate(horizon.getDate() + windowDays);

  const [milestones, snags, activeProjectCount] = await Promise.all([
    db.milestone.findMany({
      where: {
        status: { in: ["PENDING", "ACTIVE"] },
        plannedDate: { gte: startOfDayIST(now), lte: horizon },
        project: { stage: { in: IN_FLIGHT_STAGES } },
      },
      orderBy: { plannedDate: "asc" },
      take: 100,
      select: {
        id: true, name: true, plannedDate: true, billingPct: true, status: true,
        project: {
          select: {
            id: true, number: true, name: true,
            client: {
              select: { name: true, mobile: true, billingAddress: true },
            },
          },
        },
      },
    }),
    db.snag.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        project: { stage: { in: IN_FLIGHT_STAGES } },
      },
      orderBy: { raisedAt: "desc" },
      take: 100,
      select: {
        id: true, roomLabel: true, description: true, status: true, raisedAt: true,
        project: { select: { id: true, number: true, name: true } },
      },
    }),
    db.project.count({ where: { stage: { in: IN_FLIGHT_STAGES } } }),
  ]);

  return {
    windowDays,
    upcoming: milestones.map((m) => ({
      id: m.id, name: m.name, plannedDate: m.plannedDate,
      billingPct: m.billingPct.toString(), status: m.status,
      projectId: m.project.id, projectNumber: m.project.number, projectName: m.project.name,
      clientName: m.project.client.name,
      clientMobile: m.project.client.mobile,
      city: cityOf(m.project.client.billingAddress),
    })),
    snags: snags.map((s) => ({
      id: s.id, location: s.roomLabel, description: s.description,
      status: s.status, createdAt: s.raisedAt,
      projectId: s.project.id, projectNumber: s.project.number, projectName: s.project.name,
    })),
    activeProjectCount,
  };
}

export interface ProjectPickerRow {
  id: string; number: string; name: string;
}
export async function listActiveProjectsForSnag(ctx: RequestContext): Promise<ProjectPickerRow[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const rows = await db.project.findMany({
    where: { stage: { in: IN_FLIGHT_STAGES } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, number: true, name: true },
  });
  return rows;
}

function startOfDayIST(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
