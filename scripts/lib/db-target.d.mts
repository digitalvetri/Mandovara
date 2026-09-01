// Types for db-target.mjs, so prisma/seed.ts can share the one guard
// instead of keeping a second copy that drifts out of step.
export function databaseUrl(): string;
export function isLocalDatabase(): boolean;
export function wipeConfirmed(): boolean;
export function hostOf(): string;
export function assertWipeAllowed(
  countExistingRows: () => Promise<number>,
  what?: string,
): Promise<void>;
