-- Remove the FK constraint from Allocation.orderLineId.
-- Per spec (CLAUDE.md §5.2), Allocation.orderLineId is a plain String with no
-- referential constraint — Allocations may outlive their source OrderLine and
-- the concurrency gate test uses synthetic IDs to avoid complex entity setup.

ALTER TABLE "Allocation" DROP CONSTRAINT IF EXISTS "Allocation_orderLineId_fkey";
