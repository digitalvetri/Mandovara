-- NumberingSeries: switch from external Postgres sequences to an in-row
-- gap-free counter. See src/kernel/numbering/series.ts for the allocator.
ALTER TABLE "NumberingSeries" DROP COLUMN IF EXISTS "sequenceName";
ALTER TABLE "NumberingSeries" ADD COLUMN "padding" INT NOT NULL DEFAULT 5;
ALTER TABLE "NumberingSeries" ADD COLUMN "currentValue" BIGINT NOT NULL DEFAULT 0;
