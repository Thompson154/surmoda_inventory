-- 002-stores: create Store entity and back-fill FK from user_stores

-- 1. Enum + table + indexes
CREATE TYPE "store_kind" AS ENUM ('warehouse', 'branch');

CREATE TABLE "stores" (
  "id"         TEXT          NOT NULL,
  "code"       TEXT          NOT NULL,
  "name"       TEXT          NOT NULL,
  "kind"       "store_kind"  NOT NULL,
  "is_active"  BOOLEAN       NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3)  NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stores_code_key" ON "stores"("code");
CREATE INDEX "stores_is_active_kind_idx" ON "stores"("is_active", "kind");

-- 2. Seed 3 stores with preserved IDs (idempotent)
INSERT INTO "stores" ("id", "code", "name", "kind", "is_active", "created_at", "updated_at")
VALUES
  ('store-almacen-seed', 'ALMACEN', 'Almacén Central',   'warehouse', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store-prado-seed',   'PRADO',   'Sucursal Prado',    'branch',    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store-zsur-seed',    'ZSUR',    'Sucursal Zona Sur', 'branch',    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 3. Activate FK on user_stores.store_id
ALTER TABLE "user_stores"
  ADD CONSTRAINT "user_stores_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
