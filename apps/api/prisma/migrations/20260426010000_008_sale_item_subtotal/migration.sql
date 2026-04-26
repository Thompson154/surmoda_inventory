-- Feature 008: per-line discounted subtotal on SaleItem.
-- Add nullable, backfill = price_at_sale_cents * quantity, then enforce NOT NULL.

ALTER TABLE "sale_items" ADD COLUMN "subtotal_cents" INTEGER;

UPDATE "sale_items"
SET "subtotal_cents" = "price_at_sale_cents" * "quantity"
WHERE "subtotal_cents" IS NULL;

ALTER TABLE "sale_items" ALTER COLUMN "subtotal_cents" SET NOT NULL;
