// WHY: shared delivery contracts — single source of truth for FE/BE.

import type { Size } from './products';

export type DeliveryKind = 'reception' | 'distribution';

export interface DeliveryItemPayload {
  variantId: string;
  quantity: number;
}

export interface CreateDeliveryPayload {
  items: DeliveryItemPayload[];
  note?: string;
}

export interface DeliveryItemDTO {
  id: string;
  variantId: string;
  quantity: number;
  productId: string;
  productCode: string;
  productName: string;
  size: Size;
  color: string;
  barcode: string;
  imagePath?: string | null;
}

export interface DeliveryDTO {
  id: string;
  kind: DeliveryKind;
  fromStoreId: string | null;
  fromStoreName: string | null;
  toStoreId: string;
  toStoreName: string;
  createdByUserId: string;
  createdByFullName: string;
  note: string | null;
  createdAt: string;
  itemCount: number;
  totalUnits: number;
}

export interface DeliveryWithItems extends DeliveryDTO {
  items: DeliveryItemDTO[];
}

export interface PaginatedDeliveries {
  items: DeliveryDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DeliveryGroupedItem {
  productId: string;
  productCode: string;
  productName: string;
  imagePath: string | null;
  totalUnits: number;
  deliveryCount: number;
}

export interface PaginatedDeliveryGroups {
  items: DeliveryGroupedItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListDeliveriesFilters {
  q?: string;
  page?: number;
  pageSize?: number;
}
