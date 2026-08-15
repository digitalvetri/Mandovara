"use server";

// One-click "Start measurement" — combines startMeasurementRound with
// server-side device detection so the client only has to trigger the
// action and follow the redirect.
//
// Behaviours:
//   1. If the project has no rooms → returns { needsRooms: true }.
//      The caller opens the room-setup sheet instead of redirecting.
//   2. Otherwise → creates or resumes a DRAFT round, then throws a
//      Next-router redirect to the device-appropriate route.
//
// Device rule (spec §4): phone/tablet → /m/measure/[projectId];
// desktop → /projects/[id]/measurements/[measurementId].
//
// This lives in its own file (not actions.ts) because Next.js server
// actions can be called from client components only if they don't share
// a module with server-only Prisma types the client bundle can't see.

import { redirect } from "next/navigation";
import type { Route } from "next";
import { isMobileUserAgent } from "@/lib/device";
import { startMeasurementRound } from "./actions";

export interface StartAndRedirectInput {
  projectId: string;
}

export interface StartAndRedirectResult {
  ok: true;
  needsRooms: true;
}

export async function startMeasurementAndRedirect(
  input: StartAndRedirectInput,
): Promise<StartAndRedirectResult> {
  const res = await startMeasurementRound({
    projectId: input.projectId,
    visitedAt: new Date(),
  });

  if (!res.ok) {
    // The action already produced a helpful message; rethrow as a
    // recognisable Error so the client boundary shows it.
    throw new Error(res.error);
  }

  if (res.needsRooms) {
    // Client is expected to open the room-setup sheet, then re-invoke
    // this action after adding at least one room.
    return { ok: true, needsRooms: true };
  }

  const mobile = await isMobileUserAgent();
  const target: Route = mobile
    ? (`/m/measure/${input.projectId}` as Route)
    : (`/projects/${input.projectId}/measurements/${res.data.id}` as Route);

  redirect(target);
}
