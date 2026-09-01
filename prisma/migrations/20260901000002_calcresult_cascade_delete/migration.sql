-- Deleting a measurement item must not be blocked by its own calc row.
--
-- CalcResult.measurementItemId defaulted to ON DELETE RESTRICT. The
-- engine writes a CalcResult for every item that has dimensions, so the
-- Delete button on a measured window always failed with
--
--   Foreign key constraint violated on the constraint:
--   `CalcResult_measurementItemId_fkey`   (P2003)
--
-- which surfaced as a full-page "Something went wrong".
--
-- CASCADE is the correct rule, not a workaround: a CalcResult is the
-- engine's output for exactly one item (measurementItemId is UNIQUE),
-- it carries no independent meaning, and an orphan would be unreachable.
-- updateMeasurementItem already deletes and rewrites the row on every
-- edit, so the codebase has always treated it as owned, derived data.
ALTER TABLE "CalcResult" DROP CONSTRAINT "CalcResult_measurementItemId_fkey";

ALTER TABLE "CalcResult" ADD CONSTRAINT "CalcResult_measurementItemId_fkey"
  FOREIGN KEY ("measurementItemId") REFERENCES "MeasurementItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
