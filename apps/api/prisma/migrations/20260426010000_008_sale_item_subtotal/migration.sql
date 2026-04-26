-- Feature 008: per-line discounted subtotal on SaleItem.
-- Add nullable, backfill = price_at_sale_cents * quantity, then enforce NOT NULL.

ALTER TABLE "sale_items" ADD COLUMN "subtotal_cents" INTEGER;

UPDATE "sale_items"
SET "subtotal_cents" = "price_at_sale_cents" * "quantity"
WHERE "subtotal_cents" IS NULL;

-- Fail loudly if any row escaped the backfill (would silently break NOT NULL below).
DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining FROM "sale_items" WHERE "subtotal_cents" IS NULL;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % sale_items still have NULL subtotal_cents', remaining;
  END IF;
END $$;

ALTER TABLE "sale_items" ALTER COLUMN "subtotal_cents" SET NOT NULL;
