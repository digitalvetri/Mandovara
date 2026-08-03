-- ═════════════════════════════════════════════════════════════════
--  Search indexes on Product (BUILD-SPEC §9.3 raw-SQL comment)
-- ═════════════════════════════════════════════════════════════════

-- pg_trgm needed for fuzzy LIKE on Product.code
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Materialised search vector column, trigger-maintained.
ALTER TABLE "Product"
  ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION product_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('simple', coalesce(NEW.code, '')),  'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.name, '')),  'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.hsn,  '')),  'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.specs::text, '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_search_vector_trg
  BEFORE INSERT OR UPDATE OF code, name, hsn, specs
  ON "Product"
  FOR EACH ROW
  EXECUTE FUNCTION product_search_vector_update();

-- 2) GIN indexes for the search paths the catalog needs.
CREATE INDEX product_search_vector_idx ON "Product" USING GIN ("searchVector");
CREATE INDEX product_code_trgm_idx     ON "Product" USING GIN (code gin_trgm_ops);
CREATE INDEX product_specs_gin_idx     ON "Product" USING GIN (specs);

-- ═════════════════════════════════════════════════════════════════
--  Immutability at the DB level (Twelve Rules #3, #4)
--    - AuditLog:         no UPDATE, no DELETE.
--    - StockLedgerEntry: no UPDATE, no DELETE. Reversals are new rows.
--  Implemented as row-level BEFORE triggers so the block is enforced
--  regardless of the caller (Prisma, psql, superuser, extensions).
-- ═════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION mandovara_block_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only. UPDATE and DELETE are not permitted.', TG_TABLE_NAME;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable_update_trg
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION mandovara_block_update_delete();

CREATE TRIGGER audit_log_immutable_delete_trg
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION mandovara_block_update_delete();

CREATE TRIGGER stock_ledger_immutable_update_trg
  BEFORE UPDATE ON "StockLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION mandovara_block_update_delete();

CREATE TRIGGER stock_ledger_immutable_delete_trg
  BEFORE DELETE ON "StockLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION mandovara_block_update_delete();
