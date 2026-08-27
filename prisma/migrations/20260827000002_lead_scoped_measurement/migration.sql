-- Leads can be measured (2026-08-27, owner instruction).
--
-- Until now a Measurement required a Project, and a Project requires a
-- Client — so taking dimensions on a prospect's site meant converting the
-- lead to a client first, or fabricating a throwaway Project (which is
-- exactly what createStubProjectForClient did, and why it is deleted in
-- this change). Meanwhile a lead could already own a SiteVisit and a
-- Quotation. The measurement was the odd one out.
--
-- Room and Measurement now follow the same party-XOR shape Quotation has
-- carried since FIXES-01 §5.1: exactly one of projectId / leadId is set.
-- convertLead reparents both onto the new Project in the same transaction
-- that creates the Client, so nothing is orphaned at the moment of
-- conversion.

-- ── Room ───────────────────────────────────────────────────────────────
ALTER TABLE "Room" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "Room" ADD COLUMN "leadId" TEXT;

-- ── Measurement ────────────────────────────────────────────────────────
ALTER TABLE "Measurement" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "Measurement" ADD COLUMN "leadId" TEXT;

-- ── The XOR, enforced by the database, not by the form ─────────────────
-- Without these a bug could produce a room that belongs to both a lead
-- and a project, or to neither — and "neither" is unreachable from any
-- screen, so it would only ever be found by a customer.
ALTER TABLE "Room"
  ADD CONSTRAINT "Room_party_xor"
  CHECK (("projectId" IS NOT NULL) <> ("leadId" IS NOT NULL));

ALTER TABLE "Measurement"
  ADD CONSTRAINT "Measurement_party_xor"
  CHECK (("projectId" IS NOT NULL) <> ("leadId" IS NOT NULL));

-- ── Indexes for the lead-scoped read paths ─────────────────────────────
CREATE INDEX IF NOT EXISTS "Room_leadId_idx"           ON "Room" ("leadId");
CREATE INDEX IF NOT EXISTS "Measurement_leadId_status_idx" ON "Measurement" ("leadId", "status");
