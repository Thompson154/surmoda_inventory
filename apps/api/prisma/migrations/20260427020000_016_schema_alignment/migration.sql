-- DB audit cleanup post-Tier 3.
--
-- Findings reales que esta migration resuelve:
--
-- 1) `daily_reports_date_idx` (standalone btree on `date`) es redundante.
--    El composite UNIQUE (`store_id`, `date`) creado en la migration 007
--    ya cubre el dashboard query: `WHERE store_id = ? AND date BETWEEN ?`
--    + ordering por fecha (Postgres btree es bidireccional). El índice
--    standalone solo sirve queries cross-sucursal y la constitución no
--    modela ese caso. Mantenerlo cuesta espacio + IO en cada INSERT sin
--    beneficio.
--
-- 2) `users.email` schema-vs-DB drift: la migration 014 dropea el
--    `users_email_key` simple y crea `users_email_lower_key` (functional
--    UNIQUE sobre `LOWER("email")`). Esta migration RECREA el índice
--    simple para que coexista con el funcional. Ambos indexes son
--    consistentes entre sí (el funcional es estrictamente más restrictivo
--    que el simple, así que cualquier dataset que cumpla el funcional
--    cumple el simple). Schema declara `@unique` para que Prisma habilite
--    `findUnique({ where: { email } })`; el funcional sigue siendo la
--    defensa contra un import bulk que olvide lowercasear.
--
-- 3) `idempotency_keys` (migration 015) creó constraints + índice con
--    nombres custom (`_fk`, `_unique`) que no siguen la convención de
--    Prisma (`_fkey`, `_key`). Esto también provocaba drift en
--    `prisma migrate diff`. Renombramos a la convención para que el
--    schema.prisma sea la única fuente de verdad y futuros migrate dev
--    no generen ruido. La FK semántica y la uniqueness quedan idénticas.

DROP INDEX IF EXISTS "daily_reports_date_idx";

-- Recrear índice simple en users.email (dropeado en migration 014). Coexiste
-- con `users_email_lower_key` (functional UNIQUE sobre LOWER(email)). Los
-- datos existentes ya cumplen ambos: el funcional es más estricto.
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users" ("email");

-- Rename idempotency_keys constraints/index a convención Prisma.
-- ALTER ... RENAME CONSTRAINT no soporta IF EXISTS, así que envolvemos
-- en DO blocks para idempotencia (re-aplicación segura).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_keys_store_fk'
  ) THEN
    ALTER TABLE "idempotency_keys"
      RENAME CONSTRAINT "idempotency_keys_store_fk"
        TO "idempotency_keys_store_id_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_keys_sale_fk'
  ) THEN
    ALTER TABLE "idempotency_keys"
      RENAME CONSTRAINT "idempotency_keys_sale_fk"
        TO "idempotency_keys_sale_id_fkey";
  END IF;
END $$;

ALTER INDEX IF EXISTS "idempotency_keys_store_key_unique"
  RENAME TO "idempotency_keys_store_id_key_key";

-- Rename GIN index audit_logs (creado en migration 013) a la convención
-- Prisma. Esto permite declararlo en schema.prisma con
-- @@index([payload(ops: JsonbPathOps)], type: Gin) sin que prisma migrate
-- diff reporte drift por nombres distintos.
ALTER INDEX IF EXISTS "idx_audit_logs_payload_gin"
  RENAME TO "audit_logs_payload_idx";
