-- Tier 1 — production performance.
--
-- The audit log viewer (feature 015) filters by JSON path:
--   payload @> '{"storeId": "..."}'
--   payload @> '{"toStoreId": "..."}'
--   payload @> '{"fromStoreId": "..."}'
--
-- Without a GIN index every query degrades to a sequential scan that gets
-- worse linearly with row count. At ~500 audit rows/day × 5 stores × 12 months
-- that's ≥180k rows; the unindexed seqscan crosses the 1-second threshold
-- around 50k.
--
-- We use `jsonb_path_ops` (not the default `jsonb_ops`) because:
--   - The index is ~30% smaller on disk and faster to build.
--   - It only supports the `@>` operator — which is exactly what Prisma's
--     `payload: { path: [...], equals: ... }` query compiles to.
--   - Anyone needing key-existence (`?`) operators must add a separate
--     `jsonb_ops` index later; we have no such query today.
CREATE INDEX IF NOT EXISTS "idx_audit_logs_payload_gin"
  ON "audit_logs" USING GIN ("payload" jsonb_path_ops);
