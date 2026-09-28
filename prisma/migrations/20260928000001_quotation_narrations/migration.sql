-- Notes on a quotation (Transportation extra, delivery period, …).
--
-- Owner request, 2026-09-28: tick the notes that apply to a quotation and
-- fill in their wording, printed under the total on the PDF.
--
-- One nullable JSON column rather than a table: the notes are a short,
-- ordered list that is only ever read and written with the quotation
-- itself. Quotation already has its row-level-security policy.
--
-- Additive only. Existing quotations start with no notes, which is exactly
-- what they printed before.

ALTER TABLE "Quotation" ADD COLUMN "narrations" JSONB;
