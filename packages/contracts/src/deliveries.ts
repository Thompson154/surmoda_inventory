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

/**
 * Warehouse intake (reception) — alta + reposición unificadas.
 *
 * Por variante:
 *   (productCode, size, color) ya existe → suma stock; precio + imagen NO se
 *     pisan (precio queda como está, imagen sólo se setea si era null).
 *   no existe → crea Variant nueva con el precio + imagen del payload.
 *
 * El productCode (Product) se upsertea: si no existe, se crea con el code
 * provisto y un name por defecto (igual al code) — la encargada puede
 * renombrarlo después en la pantalla de productos.
 */
export interface WarehouseIntakeVariantPayload {
  /** Tamaño contractual — mismo enum que Variant.size. */
  size:
    | 's'
    | 'm'
    | 'l'
    | 'xl'
    | 'xxl'
    | '28'
    | '30'
    | '32'
    | '34'
    | 'standard';
  color: string;
  quantity: number;
  /** Precio en centavos. Sólo se aplica al CREAR la variante; reposición lo ignora. */
  priceCents: number;
  /** Imagen opcional (sólo se aplica al crear la variante o si la actual es null). */
  imageBase64?: string | null;
}

export interface WarehouseIntakePayload {
  productCode: string;
  /** Si productCode no existe lo creamos con este nombre. Opcional → default = code. */
  productName?: string;
  /** Descripción libre del modelo. Cuando se envía actualiza Product.description
   *  (alta o existente). Habilita búsqueda por texto en inventario y entregas. */
  productDescription?: string;
  /** Título descriptivo de la entrega (ej: "Mercadería nueva de Chile"). */
  title?: string;
  note?: string;
  variants: WarehouseIntakeVariantPayload[];
}

/**
 * Lookup result for the intake form. Returns the product (if it exists) plus
 * the variants currently in the warehouse so the encargada sees what she's
 * adding to vs. starting from blank.
 */
export interface WarehouseIntakeLookupItem {
  variantId: string;
  size:
    | 's'
    | 'm'
    | 'l'
    | 'xl'
    | 'xxl'
    | '28'
    | '30'
    | '32'
    | '34'
    | 'standard';
  color: string;
  priceCents: number;
  /** Stock actual de esa variante en el almacén. */
  warehouseQuantity: number;
  imagePath: string | null;
}

export interface WarehouseIntakeLookupResponse {
  exists: boolean;
  productId: string | null;
  productCode: string;
  productName: string | null;
  variants: WarehouseIntakeLookupItem[];
}

export interface ListDeliveriesFilters {
  q?: string;
  /** Filter by lifecycle status. Multiple values OR'd. */
  status?: DeliveryStatus | DeliveryStatus[];
  page?: number;
  pageSize?: number;
}
