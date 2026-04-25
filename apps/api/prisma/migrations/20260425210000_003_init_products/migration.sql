-- 003-products: Product + Variant entities + Size enum

-- 1. Size enum
CREATE TYPE "variant_size" AS ENUM ('s', 'm', 'l', 'xl', 'xxl', '28', '30', '32', '34', 'standard');

-- 2. Products table
CREATE TABLE "products" (
  "id"          TEXT          NOT NULL,
  "code"        TEXT          NOT NULL,
  "name"        TEXT          NOT NULL,
  "description" TEXT,
  "is_active"   BOOLEAN       NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3)  NOT NULL,
  "deleted_at"  TIMESTAMP(3),

  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_code_key" ON "products"("code");
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- 3. Variants table
CREATE TABLE "variants" (
  "id"          TEXT           NOT NULL,
  "product_id"  TEXT           NOT NULL,
  "size"        "variant_size" NOT NULL,
  "color"       TEXT           NOT NULL,
  "barcode"     TEXT           NOT NULL,
  "price_cents" INTEGER        NOT NULL,
  "image_path"  TEXT,
  "is_active"   BOOLEAN        NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3)   NOT NULL,
  "deleted_at"  TIMESTAMP(3),

  CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "variants_barcode_key" ON "variants"("barcode");
CREATE UNIQUE INDEX "variants_product_id_size_color_deleted_at_key"
  ON "variants"("product_id", "size", "color", "deleted_at");
CREATE INDEX "variants_product_id_is_active_idx" ON "variants"("product_id", "is_active");
CREATE INDEX "variants_barcode_idx" ON "variants"("barcode");

ALTER TABLE "variants"
  ADD CONSTRAINT "variants_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
