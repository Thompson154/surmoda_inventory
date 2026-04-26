-- 006-sales: in-store sales registration with snapshot pricing.

-- Extend StockMovementType with sale_out.
ALTER TYPE "stock_movement_type" ADD VALUE 'sale_out';

-- Payment method enum (3 fixed values per locked rule #4).
CREATE TYPE "payment_method" AS ENUM ('qr', 'card', 'cash');

-- Sale header.
CREATE TABLE "sales" (
  "id"                   TEXT             NOT NULL,
  "store_id"             TEXT             NOT NULL,
  "recorded_by_user_id"  TEXT             NOT NULL,
  "payment_method"       "payment_method" NOT NULL,
  "total_cents"          INTEGER          NOT NULL,
  "created_at"           TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_store_id_created_at_idx" ON "sales"("store_id", "created_at");

ALTER TABLE "sales"
  ADD CONSTRAINT "sales_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales"
  ADD CONSTRAINT "sales_recorded_by_user_id_fkey"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sale items (price snapshot at the moment of sale per locked rule #5).
CREATE TABLE "sale_items" (
  "id"                   TEXT    NOT NULL,
  "sale_id"              TEXT    NOT NULL,
  "variant_id"           TEXT    NOT NULL,
  "quantity"             INTEGER NOT NULL,
  "price_at_sale_cents"  INTEGER NOT NULL,

  CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");
CREATE INDEX "sale_items_variant_id_idx" ON "sale_items"("variant_id");

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
