-- Installation progress per order line (2026-08-27, owner instruction:
-- "on the installation module, listing the works").
--
-- OrderLine already tracks procuredQty and madeQty. installedQty existed
-- alongside them until the installation module was removed on 21 Aug,
-- and went with it.
--
-- This does NOT resurrect that module. The owner asked for the work to
-- be *listed* — a checklist of what goes in which room and how much of
-- it is done — not for crews, routes and visit sheets to come back. One
-- column on a table that already carries its two siblings is the whole
-- change; the project page groups the lines by room and ticks them off.
ALTER TABLE "OrderLine"
  ADD COLUMN "installedQty" DECIMAL(12,3) NOT NULL DEFAULT 0;
