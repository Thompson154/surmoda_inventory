-- Tier 3.A.3 — idempotency keys for POST /sales.
--
-- The boutique's in-store wifi will drop mid-checkout. Without idempotency,
-- the FE retry on network timeout creates a SECOND sale with the same cart —
-- inventory decremented twice, duplicate row in reports, manual cleanup by
-- the encargada. This is the single most likely user-impacting bug after
-- deploy.
--
-- Design:
--   - The FE generates a UUID v4 once per checkout attempt and sends it as
--     `idempotencyKey` on the POST /sales body.
--   - On the BE, every successful sale stores (key, saleId) here.
--   - On retry, the BE looks up the key and returns the cached saleId
--     instead of creating a new sale.
--   - Keys older than 24h are pruned by the existing job framework
--     (see jobs/idempotencyKeyCleanup.ts in the same Tier 3 batch).
--
-- The (storeId, key) pair is unique so two stores can technically reuse
-- the same UUID without collision (UUID v4 collisions are negligible, but
-- defense in depth).

CREATE TABLE "idempotency_keys" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "sale_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_store_fk"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "idempotency_keys_sale_fk"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "idempotency_keys_store_key_unique"
  ON "idempotency_keys" ("store_id", "key");

-- TTL eviction is by `created_at`; index speeds up the cleanup cron.
CREATE INDEX "idempotency_keys_created_at_idx"
  ON "idempotency_keys" ("created_at");
