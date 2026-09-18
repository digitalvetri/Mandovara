-- Two more selling units: KG and PART.
--
-- Owner instruction, 2026-09-18: quotation lines need to be sold by
-- weight (KG) and by the part (PART) alongside MTR, ROLLS, NOS, etc.
-- Additive only — existing rows keep their units.

ALTER TYPE "SellUnit" ADD VALUE IF NOT EXISTS 'KG';
ALTER TYPE "SellUnit" ADD VALUE IF NOT EXISTS 'PART';
