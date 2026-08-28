// startMeasurementRound behaviour tests — spec §7 tests #7 & #8.
//
//  #7 Zero rooms → returns needsRooms=true, no round created.
//  #8 Same user's second start returns the existing DRAFT (idempotent).
//
// Mocks the devContext() dependency so we can drive the action with a
// controlled RequestContext against the real DB.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;

const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({
  devContext: async () => ctxRef.current,
}));
// revalidatePath needs a Next request context that doesn't exist under
// vitest — stub it. The action's cache invalidation is not what we're
// testing here; the DB row it creates is.
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag:  () => {},
}));

// Import AFTER mock so the mock takes effect
const { startMeasurementRound } = await import("@/modules/measurement/actions");

async function makeProject(t: Tenant): Promise<string> {
  const c = await db.client.create({
    data: {
      organizationId: t.orgId,
      code:           `MDV/CLI-2608-${Math.random().toString(36).slice(2, 6)}`,
      name:           "Test",
      mobile:         "+919000000010",
      billingAddress: {},
    },
    select: { id: true },
  });
  const p = await db.project.create({
    data: {
      organizationId: t.orgId,
      branchId:       t.branchId,
      number:         `MDV/PRJ-2608-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`,
      name:           "Test project",
      clientId:       c.id,
      ownerId:        t.userId,
      stage:          "MEASUREMENT",
      siteAddress:    {},
    },
    select: { id: true },
  });
  return p.id;
}

async function addRoom(orgId: string, projectId: string, name: string): Promise<void> {
  await db.room.create({
    data: { organizationId: orgId, projectId, name, sortOrder: 10 },
  });
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;

  // Point devContext at a MEASURE_EXEC-like session with create.any + create
  ctxRef.current = {
    ...A.ctx,
    permissions: new Set([
      ...A.ctx.permissions,
      "measurement.create.any",
      "measurement.create",
      "project.view",
    ]),
  };
});

beforeEach(async () => {
  await db.measurement.deleteMany({});
  await db.room.deleteMany({});
  await db.project.deleteMany({});
});

// Was "zero rooms guard (spec test #7)": starting a measurement on a
// project with no rooms returned needsRooms=true, created nothing, and
// the UI opened a room-setup sheet. The owner reported that
// interruption from both the measurement page and Client 360
// (2026-08-28) — "it is asking me for add a room but I dont want like
// that" — so the room is now created rather than demanded.
//
// The invariant the guard protected still holds and is asserted below:
// a round always has a room to hang items on.
describe("startMeasurementRound — a project with no rooms", () => {
  it("starts the round anyway, creating a default room", async () => {
    const projectId = await makeProject(A);
    const res = await startMeasurementRound({
      projectId,
      visitedAt: new Date(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    // No longer interrupts.
    expect(res.needsRooms).toBeUndefined();

    // The round exists...
    const rounds = await db.measurement.count({ where: { projectId } });
    expect(rounds).toBe(1);

    // ...and so does exactly one room for it to hang items on.
    const rooms = await db.room.findMany({ where: { projectId } });
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.name).toBe("General");
  });

  it("uses the existing room instead of adding a second one", async () => {
    const projectId = await makeProject(A);
    await db.room.create({
      data: {
        organizationId: A.ctx.orgId,
        projectId,
        leadId:     null,
        name:       "Master bedroom",
        sortOrder:  0,
      },
    });

    const res = await startMeasurementRound({ projectId, visitedAt: new Date() });
    expect(res.ok).toBe(true);

    // A named room always wins — nobody's layout gets a stray "General"
    // appended to it.
    const rooms = await db.room.findMany({ where: { projectId } });
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.name).toBe("Master bedroom");
  });
});

function assertHasData<T extends { ok: boolean }>(
  r: T,
): asserts r is T & { ok: true; needsRooms?: false; data: { id: string; number: string; resumed: boolean } } {
  if (!r.ok || (r as { needsRooms?: boolean }).needsRooms) {
    throw new Error(`Expected data-carrying result, got: ${JSON.stringify(r)}`);
  }
}

describe("startMeasurementRound — resume DRAFT (spec test #8)", () => {
  it("second call by same user returns the existing DRAFT id, does not create a second row", async () => {
    const projectId = await makeProject(A);
    await addRoom(A.orgId, projectId, "Living");

    const first  = await startMeasurementRound({ projectId, visitedAt: new Date() });
    assertHasData(first);
    const firstId = first.data.id;
    expect(first.data.resumed).toBe(false);

    const second = await startMeasurementRound({ projectId, visitedAt: new Date() });
    assertHasData(second);
    expect(second.data.id).toBe(firstId);
    expect(second.data.resumed).toBe(true);

    const rounds = await db.measurement.count({ where: { projectId } });
    expect(rounds).toBe(1);
  });

  it("does NOT resume a SUBMITTED round — creates a fresh DRAFT", async () => {
    const projectId = await makeProject(A);
    await addRoom(A.orgId, projectId, "Living");

    const first = await startMeasurementRound({ projectId, visitedAt: new Date() });
    assertHasData(first);
    const firstId = first.data.id;
    await db.measurement.update({
      where: { id: firstId }, data: { status: "SUBMITTED" },
    });

    const second = await startMeasurementRound({ projectId, visitedAt: new Date() });
    assertHasData(second);
    expect(second.data.id).not.toBe(firstId);
    expect(second.data.resumed).toBe(false);

    const rounds = await db.measurement.count({ where: { projectId } });
    expect(rounds).toBe(2);
  });
});
