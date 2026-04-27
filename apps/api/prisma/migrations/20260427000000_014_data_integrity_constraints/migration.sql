-- Tier 3 — defense-in-depth at the DB layer.
--
-- The application enforces every invariant below in service code wrapped in
-- Prisma.$transaction(...). These constraints exist as a SECOND line of
-- defense: a future ORM bug, a manual SQL session by an admin, or a
-- migration script bypassing the app must not be able to violate the
-- perpetual-inventory invariant (constitution rule #4) or write nonsense
-- monetary values.
--
-- Every constraint is forward-compatible: existing rows are checked at
-- creation time. If any existing row already violates one (it shouldn't —
-- the app enforced these from day one), the migration fails fast and we
-- investigate. NOT VALID is intentionally NOT used: we want the integrity
-- to apply to the historical dataset too.

-- 1. Stock cannot go negative.
ALTER TABLE "stock_by_site"
  ADD CONSTRAINT "stock_by_site_quantity_non_negative_chk"
  CHECK ("quantity" >= 0);

-- 2. Variant catalog price must be positive (zero is a sentinel for "draft",
--    historically never persisted; if it appears we want to know).
ALTER TABLE "variants"
  ADD CONSTRAINT "variants_price_cents_positive_chk"
  CHECK ("price_cents" > 0);

-- 3. Sale items: quantity ≥ 1 (enforced by Zod min(1) but also DB),
--    priceAtSaleCents ≥ 0, subtotalCents ≥ 0.
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_quantity_positive_chk"
  CHECK ("quantity" >= 1);
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_price_at_sale_cents_non_negative_chk"
  CHECK ("price_at_sale_cents" >= 0);
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_subtotal_cents_non_negative_chk"
  CHECK ("subtotal_cents" >= 0);

-- 4. Sale.totalCents ≥ 0.
ALTER TABLE "sales"
  ADD CONSTRAINT "sales_total_cents_non_negative_chk"
  CHECK ("total_cents" >= 0);

-- 5. Delivery item quantities ≥ 1 (enforced by Zod, also at DB).
ALTER TABLE "delivery_items"
  ADD CONSTRAINT "delivery_items_quantity_positive_chk"
  CHECK ("quantity" >= 1);
-- received_quantity is nullable while in draft/sent; if set, must be ≥ 0.
ALTER TABLE "delivery_items"
  ADD CONSTRAINT "delivery_items_received_quantity_non_negative_chk"
  CHECK ("received_quantity" IS NULL OR "received_quantity" >= 0);

-- 6. Daily report monetary fields cannot be negative.
ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_total_cents_non_negative_chk"
  CHECK ("total_cents" >= 0);
ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_qr_cents_non_negative_chk"
  CHECK ("qr_cents" >= 0);
ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_card_cents_non_negative_chk"
  CHECK ("card_cents" >= 0);
ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_cash_cents_non_negative_chk"
  CHECK ("cash_cents" >= 0);
ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_item_count_non_negative_chk"
  CHECK ("item_count" >= 0);
ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_transactions_count_non_negative_chk"
  CHECK ("transactions_count" >= 0);

-- 7. Email case-insensitive uniqueness.
-- The app lowercases at Zod parse time, but a future bulk import that skips
-- the validator could land "Admin@x.com" alongside "admin@x.com". Drop the
-- existing exact-case unique index and replace with a functional one over
-- LOWER(email). The Prisma `User.email @unique` declaration stays and
-- matches the column at SELECT time; only the underlying index changes.
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (LOWER("email"));

-- 8. Audit log immutability — append-only except for the retention cron's
-- DELETE. Block any UPDATE attempt at the DB level so a buggy code path
-- cannot silently rewrite history.
CREATE OR REPLACE FUNCTION audit_logs_block_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only — UPDATE is forbidden (id=%)', OLD."id"
    USING ERRCODE = 'feature_not_supported';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON "audit_logs";
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION audit_logs_block_update();
