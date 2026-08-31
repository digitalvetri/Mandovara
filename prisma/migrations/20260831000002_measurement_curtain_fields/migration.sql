-- Curtain-only measurement fields, both optional.
--
-- The owner's brief (2026-08-31): a curtain should ask height, width, parts
-- and meters — the last two optional — while wallpaper asks only height,
-- width and quantity. Parts and meters had nowhere to go.
--
-- "parts" is how many panels the drop is split into; a wide window is
-- normally two, and the tailor has to be told. "runningMeters" is fabric
-- actually booked, which a measurer who knows the fullness by eye will
-- write down rather than let the calc derive it.
--
-- Nullable, with no backfill: every existing row predates the question, and
-- writing a made-up 1 would be indistinguishable from a measured 1.
ALTER TABLE "MeasurementItem" ADD COLUMN "parts" INTEGER;
ALTER TABLE "MeasurementItem" ADD COLUMN "runningMeters" DECIMAL(10,3);
