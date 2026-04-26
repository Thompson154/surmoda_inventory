-- 007-daily-close: immutable daily reports per store.

CREATE TABLE "daily_reports" (
  "id"                  TEXT         NOT NULL,
  "store_id"            TEXT         NOT NULL,
  "date"                DATE         NOT NULL,
  "total_cents"         INTEGER      NOT NULL,
  "qr_cents"            INTEGER      NOT NULL,
  "card_cents"          INTEGER      NOT NULL,
  "cash_cents"          INTEGER      NOT NULL,
  "item_count"          INTEGER      NOT NULL,
  "transactions_count"  INTEGER      NOT NULL,
  "closed_by_user_id"   TEXT,
  "closed_at"           TIMESTAMP(3) NOT NULL,
  "auto_closed"         BOOLEAN      NOT NULL DEFAULT false,

  CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_reports_store_id_date_key"
  ON "daily_reports"("store_id", "date");

CREATE INDEX "daily_reports_date_idx" ON "daily_reports"("date");

ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_reports"
  ADD CONSTRAINT "daily_reports_closed_by_user_id_fkey"
  FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
