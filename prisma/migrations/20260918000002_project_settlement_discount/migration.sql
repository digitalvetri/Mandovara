-- Settlement discount on a project.
--
-- Owner instruction, 2026-09-18: a client sometimes closes the account for
-- less than the quote — pays most of it and is let off the rest. There was
-- nowhere to say so: the remainder sat on the project as money still to
-- collect, forever.
--
-- Columns on Project rather than a new table: a job is closed once, and the
-- discount belongs to the job's agreement the same way orderValue does.
-- Project already has its row-level-security policy, so nothing to add there.
--
-- Additive only. Every existing project starts at 0, which is exactly the
-- behaviour it had before.

ALTER TABLE "Project" ADD COLUMN "settlementDiscount" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "settlementReason"   TEXT;
ALTER TABLE "Project" ADD COLUMN "settlementAt"       TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "settlementById"     TEXT;
