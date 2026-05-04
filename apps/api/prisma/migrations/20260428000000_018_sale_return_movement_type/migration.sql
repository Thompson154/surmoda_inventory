-- AddValue: stock_movement_type enum gets a new `sale_return` variant.
-- Safe to apply on a live DB — ALTER TYPE … ADD VALUE never rewrites rows.
ALTER TYPE "stock_movement_type" ADD VALUE 'sale_return';
