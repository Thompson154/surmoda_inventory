# Module: `products`

## Responsibility

Catalog backbone — **Product** (the SKU concept: code + name + description) and
**Variant** (a specific size + color + price + image at the SKU level). Every
domain entity that moves stock or money references a `Variant.id`.

## Public surface

- `GET    /api/v1/products` — paginated list (search `q`, `includeInactive`).
- `POST   /api/v1/products` — admin only. Returns the product with `variants: []`.
- `GET    /api/v1/products/:id` — full product + variants.
- `PATCH  /api/v1/products/:id` — admin only. Edits product header.
- `POST   /api/v1/products/:id/deactivate` — soft-delete; cannot deactivate
  while any variant has stock anywhere.
- `POST   /api/v1/products/:id/reactivate` — reverse.
- `POST   /api/v1/products/:productId/variants` — create variant (multipart
  for image upload).
- `PATCH  /api/v1/variants/:id` — edit variant (multipart).
- `POST   /api/v1/variants/:id/deactivate` / `/reactivate`.

## Key types

- `Product` — `code` (regex `[A-Z0-9_]{2,15}`, autouppercased), `name`,
  optional `description`.
- `Variant` — FK `productId`, enum `size` (`s|m|l|xl|xxl|28|30|32|34|standard`),
  free-text `color`, integer `priceCents`, deterministic `barcode` (SHA-256 of
  `code|size|color`, first 12 hex uppercased), optional `imagePath`.
- `ImageStorage` port (`imageStorage/types.ts`) — two adapters: `local` (writes
  to disk) and `cloudinary` (signed upload via SDK).

## Invariants

1. **Barcode is deterministic.** Re-creating an identical (code, size, color)
   tuple produces the same barcode. Tests assert this in
   `__tests__/barcode.spec.ts`.
2. **Image upload is double-validated.**
   - Multer enforces `5 MB` max + the MIME whitelist.
   - `imageStorage/sniff.ts` re-derives the format from magic bytes and
     rejects mismatches (defense against renamed-extension uploads).
   - Filename length capped at 255 chars before persistence.
3. **Product deactivation is blocked while any variant carries stock.** Service
   layer pre-checks across every store; raises
   `PRODUCT_HAS_STOCK_CANNOT_DEACTIVATE` (409).
4. **Variant size+color is unique per product (where deletedAt is null).**
   Service layer pre-checks before insert so the friendlier
   `VARIANT_DUPLICATE_TUPLE` wins over the DB-level barcode collision error.

## Tests

- Unit: `__tests__/service.product.spec.ts`, `__tests__/service.variant.spec.ts`,
  `__tests__/barcode.spec.ts`, `imageStorage/__tests__/sniff.spec.ts`.
- Integration: `tests/integration/products.spec.ts`.

## Related

- Used by every store-scoped module: `inventory`, `deliveries`, `sales`.
- Cloudinary credentials: required only when `IMAGE_STORAGE=cloudinary`;
  validated at boot via `infrastructure/config.ts` superRefine.
