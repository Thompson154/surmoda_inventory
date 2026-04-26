-- Feature 011: deliveries become a multi-step flow.
--
-- Existing rows are real (or seeded) deliveries that already moved stock when
-- they were created, so the safe backfill is "received" with received_at = created_at.
-- This preserves historical reports while letting new deliveries follow the
-- draft → sent → received|partial flow going forward.

CREATE TYPE "delivery_status" AS ENUM ('draft', 'sent', 'received', 'partial');

ALTER TYPE "stock_movement_type" ADD VALUE 'delivery_received_adjusted';

-- Sequential human-friendly id. Globally unique. Sequence created by Postgres.
ALTER TABLE "deliveries" ADD COLUMN "number" SERIAL;
CREATE UNIQUE INDEX "deliveries_number_key" ON "deliveries"("number");

ALTER TABLE "deliveries" ADD COLUMN "title" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "status" "delivery_status" NOT NULL DEFAULT 'received';
ALTER TABLE "deliveries" ADD COLUMN "sent_at" TIMESTAMP(3);
ALTER TABLE "deliveries" ADD COLUMN "received_at" TIMESTAMP(3);
ALTER TABLE "deliveries" ADD COLUMN "received_by_user_id" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "deliveries" SET "received_at" = "created_at" WHERE "received_at" IS NULL;

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_received_by_user_id_fkey"
  FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "deliveries_status_to_store_id_idx" ON "deliveries"("status", "to_store_id");

ALTER TABLE "delivery_items" ADD COLUMN "received_quantity" INTEGER;
-- Backfill received_quantity to match quantity for historical rows since the
-- stock was already applied at creation time.
UPDATE "delivery_items" SET "received_quantity" = "quantity" WHERE "received_quantity" IS NULL;

CREATE TABLE "delivery_item_adjustments" (
  "id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "delivery_item_id" TEXT NOT NULL,
  "expected_qty" INTEGER NOT NULL,
  "actual_qty" INTEGER NOT NULL,
  "reason" TEXT,
  "adjusted_by_user_id" TEXT NOT NULL,
  "adjusted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_item_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_item_adjustments_delivery_id_idx" ON "delivery_item_adjustments"("delivery_id");
CREATE INDEX "delivery_item_adjustments_adjusted_by_user_id_adjusted_at_idx"
  ON "delivery_item_adjustments"("adjusted_by_user_id", "adjusted_at");

ALTER TABLE "delivery_item_adjustments" ADD CONSTRAINT "delivery_item_adjustments_delivery_id_fkey"
  FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_item_adjustments" ADD CONSTRAINT "delivery_item_adjustments_delivery_item_id_fkey"
  FOREIGN KEY ("delivery_item_id") REFERENCES "delivery_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_item_adjustments" ADD CONSTRAINT "delivery_item_adjustments_adjusted_by_user_id_fkey"
  FOREIGN KEY ("adjusted_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
