import type {
  ConfirmDraftPayload,
  CreateDeliveryPayload,
  DeliveryDTO as DeliveryDTOContract,
  DeliveryGroupedItem as DeliveryGroupedItemContract,
  DeliveryItemDTO as DeliveryItemDTOContract,
  DeliveryKind as DeliveryKindContract,
  DeliveryStatus as DeliveryStatusContract,
  DeliveryWithItems as DeliveryWithItemsContract,
  ListDeliveriesFilters,
  PaginatedDeliveries as PaginatedDeliveriesContract,
  PaginatedDeliveryGroups as PaginatedDeliveryGroupsContract,
  ReceiveDeliveryPayload,
  UpdateDraftDeliveryPayload,
} from '@surmoda/contracts';

export type DeliveryKind = DeliveryKindContract;
export type DeliveryStatus = DeliveryStatusContract;
export type DeliveryDTO = DeliveryDTOContract;
export type DeliveryItemDTO = DeliveryItemDTOContract;
export type DeliveryWithItems = DeliveryWithItemsContract;
export type DeliveryGroupedItem = DeliveryGroupedItemContract;
export type PaginatedDeliveries = PaginatedDeliveriesContract;
export type PaginatedDeliveryGroups = PaginatedDeliveryGroupsContract;
export type CreateDeliveryDTO = CreateDeliveryPayload;
export type UpdateDraftDeliveryDTO = UpdateDraftDeliveryPayload;
export type ConfirmDraftDTO = ConfirmDraftPayload;
export type ReceiveDeliveryDTO = ReceiveDeliveryPayload;
export type ListDeliveriesFiltersDTO = ListDeliveriesFilters;

export interface ListDeliveriesQuery {
  q?: string;
  status?: DeliveryStatus[];
  /** Module 11 — direction relative to the path :storeId. Defaults to incoming. */
  direction?: 'incoming' | 'outgoing' | 'both';
  page: number;
  pageSize: number;
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}
