-- Remember which unit a measurement was typed in.
--
-- Dimensions stay in millimetres; this column only records what the
-- person was reading off their tape, so the same number can be shown
-- back to them in inches or feet instead of a converted mm figure.
--
-- Nullable with no backfill on purpose: rows written before today have
-- no record of the entry unit, and guessing one would put an invented
-- measurement in front of a client. Null reads as mm.
ALTER TABLE "MeasurementItem" ADD COLUMN "enteredUnit" VARCHAR(4);
