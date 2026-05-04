-- Migration: 017_add_inventory_snapshots
-- Point-in-time inventory snapshots for historical reports and bank-loan evidence.
-- Written weekly by the snapshot cron (Sundays 03:00 Bolivia time) and
-- on-demand via POST /api/v1/inventory-snapshots (admin only).

CREATE TABLE "inventory_snapshots" (
    "id"           TEXT         NOT NULL,
    "store_id"     TEXT         NOT NULL,
    "variant_id"   TEXT         NOT NULL,
    "quantity"     INTEGER      NOT NULL,
    "captured_at"  TIMESTAMPTZ  NOT NULL,
    "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_snapshots_pkey" PRIMARY KEY ("id")
);

-- Unique: one row per (store, variant, capture timestamp). Prevents double-capture within a batch.
CREATE UNIQUE INDEX "inventory_snapshots_store_variant_captured_at_unique"
    ON "inventory_snapshots"("store_id", "variant_id", "captured_at");

-- Descending index for efficient "latest snapshot at or before date X" queries.
CREATE INDEX "inventory_snapshots_store_id_captured_at_idx"
    ON "inventory_snapshots"("store_id", "captured_at" DESC);

-- Cross-store scan by date (e.g. "all stores at date X").
CREATE INDEX "inventory_snapshots_captured_at_idx"
    ON "inventory_snapshots"("captured_at");

-- FK: store
ALTER TABLE "inventory_snapshots"
    ADD CONSTRAINT "inventory_snapshots_store_id_fkey"
    FOREIGN KEY ("store_id")
    REFERENCES "stores"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: variant
ALTER TABLE "inventory_snapshots"
    ADD CONSTRAINT "inventory_snapshots_variant_id_fkey"
    FOREIGN KEY ("variant_id")
    REFERENCES "variants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
