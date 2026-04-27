// WHY: shared product/variant contracts — single source of truth for FE/BE.
// Mirrors Prisma `Size` enum + `Product`/`Variant` models without leaking Prisma types.

export type Size = 's' | 'm' | 'l' | 'xl' | 'xxl' | '28' | '30' | '32' | '34' | 'standard';

export const SIZE_VALUES: readonly Size[] = [
  's',
  'm',
  'l',
  'xl',
  'xxl',
  '28',
  '30',
  '32',
  '34',
  'standard',
] as const;

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Variant {
  id: string;
  productId: string;
  size: Size;
  color: string;
  barcode: string;
  priceCents: number;
  imagePath?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductWithVariants extends Product {
  variants: Variant[];
}

export interface ProductListItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  variantsCount: number;
  /** Path/URL de la imagen de UNA variante (la primera activa por orden de creación)
   *  para que el catálogo admin pueda mostrar miniatura sin un fetch extra por fila.
   *  Null cuando no hay variantes activas o ninguna tiene imagen. */
  representativeImagePath?: string | null;
  createdAt: string;
}

export interface PaginatedProducts {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateProductPayload {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateProductPayload {
  code?: string;
  name?: string;
  description?: string;
}

export interface ListProductsFilters {
  q?: string;
  isActive?: boolean;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

// WHY: variant create is multipart (image upload). Body fields are sent as text in
// the FormData; this interface documents the shape of those fields.
export interface CreateVariantBody {
  size: Size;
  color: string;
  priceCents: number;
}

// WHY: image is RE-uploadable via the same multipart endpoint shape as create.
// Price, size, and color are now mutable. When size or color changes the BE
// auto-regenerates the variant barcode (deterministic over (productCode, size, color)).
export interface UpdateVariantBody {
  priceCents?: number;
  size?: Size;
  color?: string;
}
