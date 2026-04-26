// WHY: shared delivery contracts — single source of truth for FE/BE.

import type { Size } from './products';

export type DeliveryKind = 'reception' | 'distribution';

/**
 * Lifecycle of a distribution delivery:
 *   draft     → encargada is composing items; stock untouched
 *   sent      → encargada confirmed; awaiting reception; stock untouched
 *   received  → vendedora confirmed with original quantities; stock applied
 *   partial   → vendedora confirmed with adjusted quantities; stock applied
 *               with adjusted numbers + DeliveryItemAdjustment row(s) emitted.
 * Reception deliveries (warehouse intake) skip draft/sent and are born
 * `received`.
 */
export type DeliveryStatus = 'draft' | 'sent' | 'received' | 'partial';

export interface DeliveryItemPayload {
  variantId: string;
  quantity: number;
}

export interface CreateDeliveryPayload {
  items: DeliveryItemPayload[];
  note?: string;
  /** Free-text title set by the encargada — required when leaving draft. */
  title?: string;
  /** When true the BE creates the delivery in `draft` instead of skipping
   *  straight to `received`. Only valid for distribution kind. */
  asDraft?: boolean;
}

/** Update of a delivery currently in `draft`. */
export interface UpdateDraftDeliveryPayload {
  title?: string;
  note?: string;
  items?: DeliveryItemPayload[];
}

export interface ConfirmDraftPayload {
  /** Optional title override at confirm time. If draft already had one, ignored. */
  title?: string;
}

export interface ReceiveDeliveryItemAdjustment {
  deliveryItemId: string;
  /** Quantity actually received. May equal expected (no adjustment) or be lower. */
  receivedQuantity: number;
  /** Optional reason text for the audit row when adjusted. */
  reason?: string;
}

export interface ReceiveDeliveryPayload {
  /** One entry per line. Lines whose receivedQuantity equals quantity are no-ops
   *  (no adjustment row), but they must be present so the BE can verify the
   *  vendedora confirmed every line. */
  items: ReceiveDeliveryItemAdjustment[];
}

export interface DeliveryItemDTO {
  id: string;
  variantId: string;
  /** Quantity originally sent (frozen once status leaves draft). */
  quantity: number;
  /** Quantity actually received. Equals `quantity` until reception confirms; null while in draft/sent. */
  receivedQuantity: number | null;
  productId: string;
  productCode: string;
  productName: string;
  size: Size;
  color: string;
  barcode: string;
  imagePath?: string | null;
}

export interface DeliveryAdjustmentDTO {
  id: string;
  deliveryItemId: string;
  expectedQty: number;
  actualQty: number;
  reason: string | null;
  adjustedByUserId: string;
  adjustedByFullName: string;
  adjustedAt: string;
}

export interface DeliveryDTO {
  id: string;
  /** Sequential id rendered as "EN-{n.padStart(4)}" on the FE. */
  number: number;
  kind: DeliveryKind;
  status: DeliveryStatus;
  title: string | null;
  fromStoreId: string | null;
  fromStoreName: string | null;
  toStoreId: string;
  toStoreName: string;
  createdByUserId: string;
  createdByFullName: string;
  receivedByUserId: string | null;
  receivedByFullName: string | null;
  note: string | null;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  itemCount: number;
  totalUnits: number;
}

export interface DeliveryWithItems extends DeliveryDTO {
  items: DeliveryItemDTO[];
  adjustments: DeliveryAdjustmentDTO[];
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
  /** Filter by lifecycle status. Multiple values OR'd. */
  status?: DeliveryStatus | DeliveryStatus[];
  page?: number;
  pageSize?: number;
}
