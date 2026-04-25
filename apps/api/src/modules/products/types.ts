import type {
  CreateProductPayload,
  CreateVariantBody,
  ListProductsFilters,
  PaginatedProducts as PaginatedProductsContract,
  Product as ProductContract,
  ProductListItem as ProductListItemContract,
  ProductWithVariants as ProductWithVariantsContract,
  Size as SizeContract,
  UpdateProductPayload,
  UpdateVariantBody,
  Variant as VariantContract,
} from '@surmoda/contracts';

export type Size = SizeContract;
export type ProductDTO = ProductContract;
export type ProductWithVariantsDTO = ProductWithVariantsContract;
export type ProductListItem = ProductListItemContract;
export type PaginatedProducts = PaginatedProductsContract;
export type VariantDTO = VariantContract;

export type CreateProductDTO = CreateProductPayload;
export type UpdateProductDTO = UpdateProductPayload;
export type ListProductsFiltersDTO = ListProductsFilters;
export type CreateVariantDTO = CreateVariantBody;
export type UpdateVariantDTO = UpdateVariantBody;

// WHY: BE-specific — page/pageSize REQUIRED here (Zod defaults them upstream).
export interface ListProductsQuery {
  q?: string;
  isActive?: boolean;
  includeInactive?: boolean;
  page: number;
  pageSize: number;
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}
