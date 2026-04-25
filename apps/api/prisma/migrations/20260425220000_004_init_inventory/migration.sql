-- 004-inventory: per-store stock + movement log + edit-permission toggle.

CREATE TYPE "stock_movement_type" AS ENUM ('adjusted', 'edit_permission_toggled');

CREATE TABLE "stock_by_site" (
  "id"         TEXT         NOT NULL,
  "variant_id" TEXT         NOT NULL,
  "store_id"   TEXT         NOT NULL,
  "quantity"   INTEGER      NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stock_by_site_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_by_site_variant_id_store_id_key"
  ON "stock_by_site"("variant_id", "store_id");
CREATE INDEX "stock_by_site_store_id_idx" ON "stock_by_site"("store_id");

ALTER TABLE "stock_by_site"
  ADD CONSTRAINT "stock_by_site_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_by_site"
  ADD CONSTRAINT "stock_by_site_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "stock_movements" (
  "id"         TEXT                  NOT NULL,
  "store_id"   TEXT                  NOT NULL,
  "variant_id" TEXT,
  "user_id"    TEXT                  NOT NULL,
  "type"       "stock_movement_type" NOT NULL,
  "payload"    JSONB                 NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_movements_store_id_created_at_idx"
  ON "stock_movements"("store_id", "created_at");
CREATE INDEX "stock_movements_variant_id_idx" ON "stock_movements"("variant_id");

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "store_edit_permission" (
  "store_id"           TEXT         NOT NULL,
  "is_enabled"         BOOLEAN      NOT NULL DEFAULT false,
  "toggled_by_user_id" TEXT,
  "toggled_at"         TIMESTAMP(3),

  CONSTRAINT "store_edit_permission_pkey" PRIMARY KEY ("store_id")
);

ALTER TABLE "store_edit_permission"
  ADD CONSTRAINT "store_edit_permission_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "store_edit_permission"
  ADD CONSTRAINT "store_edit_permission_toggled_by_user_id_fkey"
  FOREIGN KEY ("toggled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
