-- AddValue: delivery_status enum gets `partial_confirmed`.
-- Safe to apply on a live DB — ALTER TYPE … ADD VALUE never rewrites rows.
ALTER TYPE "delivery_status" ADD VALUE IF NOT EXISTS 'partial_confirmed';
