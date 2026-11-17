-- AlterTable
ALTER TABLE "inventory_snapshots" ALTER COLUMN "captured_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- RenameIndex
ALTER INDEX "inventory_snapshots_store_variant_captured_at_unique" RENAME TO "inventory_snapshots_store_id_variant_id_captured_at_key";
