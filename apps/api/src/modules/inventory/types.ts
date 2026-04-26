import type {
  AdjustQuantityPayload,
  GroupedInventoryItem as GroupedInventoryItemContract,
  InventoryRow as InventoryRowContract,
  ListInventoryFilters,
  PaginatedGroupedInventory as PaginatedGroupedInventoryContract,
  PaginatedInventory as PaginatedInventoryContract,
  PaginatedStockMovements as PaginatedStockMovementsContract,
  StockMovement as StockMovementContract,
  StockMovementPayload,
  StockMovementType,
  StoreEditPermissionDTO as StoreEditPermissionDTOContract,
  TogglePermissionPayload,
} from '@surmoda/contracts';

export type InventoryRowDTO = InventoryRowContract;
export type PaginatedInventory = PaginatedInventoryContract;
export type GroupedInventoryItem = GroupedInventoryItemContract;
export type PaginatedGroupedInventory = PaginatedGroupedInventoryContract;
export type StockMovementDTO = StockMovementContract;
export type PaginatedStockMovements = PaginatedStockMovementsContract;
export type StoreEditPermissionDTO = StoreEditPermissionDTOContract;

export type AdjustQuantityDTO = AdjustQuantityPayload;
export type TogglePermissionDTO = TogglePermissionPayload;
export type ListInventoryFiltersDTO = ListInventoryFilters;
export type { StockMovementPayload, StockMovementType };

export interface ListInventoryQuery {
  q?: string;
  stockStatus?: 'low' | 'zero';
  size?: 's' | 'm' | 'l' | 'xl' | 'xxl' | '28' | '30' | '32' | '34' | 'standard';
  color?: string;
  page: number;
  pageSize: number;
}

export interface ListMovementsQuery {
  page: number;
  pageSize: number;
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}
