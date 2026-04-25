import type {
  CreateDeliveryPayload,
  DeliveryDTO as DeliveryDTOContract,
  DeliveryGroupedItem as DeliveryGroupedItemContract,
  DeliveryItemDTO as DeliveryItemDTOContract,
  DeliveryKind as DeliveryKindContract,
  DeliveryWithItems as DeliveryWithItemsContract,
  ListDeliveriesFilters,
  PaginatedDeliveries as PaginatedDeliveriesContract,
  PaginatedDeliveryGroups as PaginatedDeliveryGroupsContract,
} from '@surmoda/contracts';

export type DeliveryKind = DeliveryKindContract;
export type DeliveryDTO = DeliveryDTOContract;
export type DeliveryItemDTO = DeliveryItemDTOContract;
export type DeliveryWithItems = DeliveryWithItemsContract;
export type DeliveryGroupedItem = DeliveryGroupedItemContract;
export type PaginatedDeliveries = PaginatedDeliveriesContract;
export type PaginatedDeliveryGroups = PaginatedDeliveryGroupsContract;
export type CreateDeliveryDTO = CreateDeliveryPayload;
export type ListDeliveriesFiltersDTO = ListDeliveriesFilters;

export interface ListDeliveriesQuery {
  q?: string;
  page: number;
  pageSize: number;
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}
