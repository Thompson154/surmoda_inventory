// WHY: shared inventory contracts — single source of truth for FE/BE.

import type { Size } from './products';

export type StockMovementType =
  | 'adjusted'
  | 'edit_permission_toggled'
  | 'delivery_in'
  | 'delivery_out'
  | 'delivery_received_adjusted'
  | 'sale_out'
  | 'sale_return';

export interface InventoryRow {
  variantId: string;
  productId: string;
  productCode: string;
  productName: string;
  size: Size;
  color: string;
  barcode: string;
  priceCents: number;
  imagePath?: string | null;
  quantity: number;
}

export interface PaginatedInventory {
  items: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GroupedInventoryItem {
  productId: string;
  productCode: string;
  productName: string;
  imagePath: string | null;
  totalQuantity: number;
  variantsCount: number;
  /** Variants of this product with quantity in 1..5 (low) at the requested store. */
  lowVariantsCount: number;
  /** Variants of this product with quantity = 0 (out) at the requested store. */
  zeroVariantsCount: number;
  /** Barcode of one of the variants (first encountered). Null if no variants. */
  representativeBarcode: string | null;
}

export interface PaginatedGroupedInventory {
  items: GroupedInventoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdjustQuantityPayload {
  quantity: number;
  reason?: string;
}

export type InventoryStockStatus = 'low' | 'zero';

export interface ListInventoryFilters {
  q?: string;
  /** Aggregate state across all variants of the product. */
  stockStatus?: InventoryStockStatus;
  /** Variant size filter (Prisma enum string). */
  size?: 's' | 'm' | 'l' | 'xl' | 'xxl' | '28' | '30' | '32' | '34' | 'standard';
  /** Variant color (case-insensitive substring match on the BE). */
  color?: string;
  page?: number;
  pageSize?: number;
}

export interface StockMovementPayload {
  delta?: number;
  previous?: number;
  next?: number;
  /** Used by delivery_in, delivery_out and sale_out movements instead of delta. */
  quantity?: number;
  reason?: string | null;
  isEnabled?: boolean;
}

export interface StockMovement {
  id: string;
  storeId: string;
  variantId: string | null;
  userId: string;
  userFullName: string;
  type: StockMovementType;
  payload: StockMovementPayload;
  productCode: string | null;
  /** Nombre del producto al momento de leer el movimiento. Permite que la
   *  UI del drawer muestre algo legible ("Polera azul talla M") en vez de
   *  solo un código alfanumérico. Null cuando el movimiento no tiene
   *  variante asociada (edit_permission_toggled). */
  productName: string | null;
  barcode: string | null;
  /** Tamaño + color de la variante para que el drawer muestre la
   *  identificación humana sin un fetch extra. Null para movimientos sin
   *  variante. */
  variantSize: string | null;
  variantColor: string | null;
  createdAt: string;
}

export interface PaginatedStockMovements {
  items: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StoreEditPermissionDTO {
  storeId: string;
  isEnabled: boolean;
  toggledByUserId: string | null;
  toggledAt: string | null;
}

export interface TogglePermissionPayload {
  isEnabled: boolean;
}
