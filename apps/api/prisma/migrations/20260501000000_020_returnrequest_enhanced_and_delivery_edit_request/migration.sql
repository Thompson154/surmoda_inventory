-- Migration 020: ReturnRequest enhancement (Wave 5) + DeliveryEditRequest model
-- WHY: identify the ORIGINAL sale being changed and capture NEW sale data so admin
--      approve can replace the SaleItem in the original closure. Plus a separate
--      workflow for vendedora/encargada to request edits to sent deliveries.

-- ─── ReturnRequest enhancements ────────────────────────────────────────────────
ALTER TABLE "return_requests"
  ADD COLUMN "original_sale_id" TEXT,
  ADD COLUMN "original_sale_item_id" TEXT,
  ADD COLUMN "original_closure_date" DATE,
  ADD COLUMN "original_payment_method" "payment_method",
  ADD COLUMN "original_subtotal_cents" INTEGER,
  ADD COLUMN "new_payment_method" "payment_method",
  ADD COLUMN "new_subtotal_cents" INTEGER;

-- WHY: enables the "find requests for this sale" lookup admin uses on approve.
CREATE INDEX "return_requests_original_sale_id_idx" ON "return_requests"("original_sale_id");

-- AddForeignKey
ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_original_sale_id_fkey"
  FOREIGN KEY ("original_sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── DeliveryEditRequest model ────────────────────────────────────────────────
-- CreateEnum
CREATE TYPE "delivery_edit_request_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "delivery_edit_requests" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "delivery_edit_request_status" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_edit_requests_delivery_id_status_idx" ON "delivery_edit_requests"("delivery_id", "status");

-- CreateIndex
CREATE INDEX "delivery_edit_requests_requester_id_created_at_idx" ON "delivery_edit_requests"("requester_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_edit_requests_status_created_at_idx" ON "delivery_edit_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "delivery_edit_requests"
  ADD CONSTRAINT "delivery_edit_requests_delivery_id_fkey"
  FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_edit_requests"
  ADD CONSTRAINT "delivery_edit_requests_requester_id_fkey"
  FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_edit_requests"
  ADD CONSTRAINT "delivery_edit_requests_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
