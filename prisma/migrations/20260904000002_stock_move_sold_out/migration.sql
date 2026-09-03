-- A counter sale is its own kind of stock movement.
--
-- Until now the only way to take sold goods off the shelf was
-- ADJUSTMENT, which exists for corrections: a physical count that
-- disagreed with the system, damage, shrinkage. Filing sales there
-- makes the two indistinguishable in StockMove, so "how much did we
-- sell this month" and "how much did we lose" become the same number.
--
-- Its own value in its own migration: Postgres will not let a new enum
-- label be USED in the same transaction that adds it, and Prisma runs
-- one migration file per transaction. The code that writes SOLD_OUT
-- rows ships alongside, but the label must land first.

ALTER TYPE "StockMoveType" ADD VALUE IF NOT EXISTS 'SOLD_OUT';
