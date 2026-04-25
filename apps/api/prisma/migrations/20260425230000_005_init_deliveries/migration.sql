-- 005-deliveries: receptions to warehouse + distributions warehouse → branch.

-- Extend StockMovementType enum with delivery values.
ALTER TYPE "stock_movement_type" ADD VALUE 'delivery_in';
ALTER TYPE "stock_movement_type" ADD VALUE 'delivery_out';

-- Delivery kind enum.
CREATE TYPE "delivery_kind" AS ENUM ('reception', 'distribution');

-- Deliveries header.
CREATE TABLE "deliveries" (
  "id"                 TEXT             NOT NULL,
  "kind"               "delivery_kind"  NOT NULL,
  "from_store_id"      TEXT,
  "to_store_id"        TEXT             NOT NULL,
  "created_by_user_id" TEXT             NOT NULL,
  "note"               TEXT,
  "created_at"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deliveries_to_store_id_created_at_idx"
  ON "deliveries"("to_store_id", "created_at");
CREATE INDEX "deliveries_from_store_id_created_at_idx"
  ON "deliveries"("from_store_id", "created_at");

ALTER TABLE "deliveries"
  ADD CONSTRAINT "deliveries_to_store_id_fkey"
  FOREIGN KEY ("to_store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deliveries"
  ADD CONSTRAINT "deliveries_from_store_id_fkey"
  FOREIGN KEY ("from_store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deliveries"
  ADD CONSTRAINT "deliveries_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Delivery items.
CREATE TABLE "delivery_items" (
  "id"          TEXT    NOT NULL,
  "delivery_id" TEXT    NOT NULL,
  "variant_id"  TEXT    NOT NULL,
  "quantity"    INTEGER NOT NULL,

  CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_items_delivery_id_idx" ON "delivery_items"("delivery_id");
CREATE INDEX "delivery_items_variant_id_idx" ON "delivery_items"("variant_id");

ALTER TABLE "delivery_items"
  ADD CONSTRAINT "delivery_items_delivery_id_fkey"
  FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_items"
  ADD CONSTRAINT "delivery_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "variants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
