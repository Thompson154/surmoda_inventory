-- Migration 019: Add ReturnRequest model + SaleItem.totalCents dual-field model
-- WHY: separates undiscounted line total from charged amount for return and discount audit.

-- CreateEnum
CREATE TYPE "return_request_status" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable: add total_cents; backfill from subtotal_cents so existing rows migrate losslessly.
ALTER TABLE "sale_items" ADD COLUMN "total_cents" INTEGER;
UPDATE "sale_items" SET "total_cents" = "subtotal_cents";
ALTER TABLE "sale_items" ALTER COLUMN "total_cents" SET NOT NULL;

-- CreateTable
CREATE TABLE "return_requests" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "status" "return_request_status" NOT NULL DEFAULT 'pending',
    "returned_variant_id" TEXT NOT NULL,
    "returned_quantity" INTEGER NOT NULL DEFAULT 1,
    "sale_date" TIMESTAMP(3) NOT NULL,
    "exchange_variant_id" TEXT,
    "reason" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "applied_return_movement_id" TEXT,
    "applied_sale_movement_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_requests_store_id_status_idx" ON "return_requests"("store_id", "status");

-- CreateIndex
CREATE INDEX "return_requests_requester_id_created_at_idx" ON "return_requests"("requester_id", "created_at");

-- CreateIndex
CREATE INDEX "return_requests_status_created_at_idx" ON "return_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_returned_variant_id_fkey" FOREIGN KEY ("returned_variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_exchange_variant_id_fkey" FOREIGN KEY ("exchange_variant_id") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
