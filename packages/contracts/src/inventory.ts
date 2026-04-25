// WHY: shared inventory contracts — single source of truth for FE/BE.

import type { Size } from './products';

export type StockMovementType =
  | 'adjusted'
  | 'edit_permission_toggled'
  | 'delivery_in'
  | 'delivery_out';

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

export interface ListInventoryFilters {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface StockMovementPayload {
  delta?: number;
  previous?: number;
  next?: number;
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
  barcode: string | null;
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
