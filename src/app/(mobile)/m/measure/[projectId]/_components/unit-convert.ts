// The field PWA's conversion entry point.
//
// The arithmetic moved to @/modules/measurement/units when the desktop
// cards needed to read dimensions back in the unit they were typed in.
// Re-exported here so the PWA's own imports stay local and short.

export { toMm, fromMm, UNIT_LABEL } from "@/modules/measurement/units";
