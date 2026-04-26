-- Feature 012: dark-launch the daily sales lock column. The cron job that
-- toggles this column is gated by env `ENABLE_DAILY_SALES_LOCK` so the column
-- can ship to prod before the behaviour is enabled.

ALTER TABLE "stores" ADD COLUMN "sales_locked_at" TIMESTAMP(3);
