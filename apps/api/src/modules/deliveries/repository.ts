import {
  Prisma,
  type DeliveryKind as PrismaDeliveryKind,
  type DeliveryStatus as PrismaDeliveryStatus,
} from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import { SIZE_FROM_PRISMA } from '../../shared/enums/mappings';
import type {
  DeliveryGroupedItem,
  DeliveryKind,
  DeliveryStatus,
  DeliveryWithItems,
  ListDeliveriesQuery,
  PaginatedDeliveries,
  PaginatedDeliveryGroups,
} from './types';

export type DeliveryTx = Prisma.TransactionClient;

const KIND_FROM_PRISMA: Record<PrismaDeliveryKind, DeliveryKind> = {
  reception: 'reception',
  distribution: 'distribution',
};

const KIND_TO_PRISMA: Record<DeliveryKind, PrismaDeliveryKind> = {
  reception: 'reception',
  distribution: 'distribution',
};

const STATUS_FROM_PRISMA: Record<PrismaDeliveryStatus, DeliveryStatus> = {
  draft: 'draft',
  sent: 'sent',
  received: 'received',
  partial: 'partial',
};

const STATUS_TO_PRISMA: Record<DeliveryStatus, PrismaDeliveryStatus> = {
  draft: 'draft',
  sent: 'sent',
  received: 'received',
  partial: 'partial',
};

export interface CreateDeliveryHeaderInput {
  kind: DeliveryKind;
  status: DeliveryStatus;
  title: string | null;
  fromStoreId: string | null;
  toStoreId: string;
  createdByUserId: string;
  note: string | null;
  /** When status === 'received' on creation (legacy reception flow), set sent/received timestamps to now. */
  receivedAtNow?: boolean;
}

export interface CreateDeliveryItemRow {
  variantId: string;
  quantity: number;
}

export interface DeliveryAdjustmentInput {
  deliveryItemId: string;
  expectedQty: number;
  actualQty: number;
  reason: string | null;
  adjustedByUserId: string;
}

export interface DeliveryRepository {
  findActiveWarehouse(tx?: DeliveryTx): Promise<{ id: string } | null>;
  variantsExistAndActive(variantIds: string[], tx?: DeliveryTx): Promise<Set<string>>;
  loadStockForVariants(
    storeId: string,
    variantIds: string[],
    tx: DeliveryTx,
  ): Promise<Map<string, number>>;
  decrementStock(storeId: string, variantId: string, qty: number, tx: DeliveryTx): Promise<number>;
  incrementStock(storeId: string, variantId: string, qty: number, tx: DeliveryTx): Promise<number>;
  createMovement(
    input: {
      storeId: string;
      variantId: string;
      userId: string;
      type: 'delivery_in' | 'delivery_out' | 'delivery_received_adjusted';
      payload: Record<string, unknown>;
    },
    tx: DeliveryTx,
  ): Promise<void>;
  createDelivery(header: CreateDeliveryHeaderInput, items: CreateDeliveryItemRow[], tx: DeliveryTx): Promise<{ id: string }>;
  loadForUpdate(deliveryId: string, tx: DeliveryTx): Promise<{
    id: string;
    status: DeliveryStatus;
    kind: DeliveryKind;
    title: string | null;
    fromStoreId: string | null;
    toStoreId: string;
    items: Array<{ id: string; variantId: string; quantity: number; receivedQuantity: number | null }>;
  } | null>;
  updateDraftHeader(
    deliveryId: string,
    patch: { title?: string | null; note?: string | null },
    tx: DeliveryTx,
  ): Promise<void>;
  replaceDraftItems(
    deliveryId: string,
    items: CreateDeliveryItemRow[],
    tx: DeliveryTx,
  ): Promise<void>;
  setStatus(
    deliveryId: string,
    status: DeliveryStatus,
    timestamps: { sentAt?: Date; receivedAt?: Date },
    receivedByUserId: string | null,
    tx: DeliveryTx,
  ): Promise<void>;
  setReceivedQuantity(
    deliveryItemId: string,
    receivedQuantity: number,
    tx: DeliveryTx,
  ): Promise<void>;
  recordAdjustments(
    deliveryId: string,
    rows: DeliveryAdjustmentInput[],
    tx: DeliveryTx,
  ): Promise<void>;
  findDelivery(deliveryId: string): Promise<DeliveryWithItems | null>;
  list(storeId: string, query: ListDeliveriesQuery): Promise<PaginatedDeliveries>;
  listGroupedByProduct(
    storeId: string,
    query: ListDeliveriesQuery,
  ): Promise<PaginatedDeliveryGroups>;
  runSerializable<T>(fn: (tx: DeliveryTx) => Promise<T>): Promise<T>;
}

export function buildDeliveryRepository(db: Database): DeliveryRepository {
  // Single shape used everywhere a full DeliveryWithItems is reconstructed.
  const fullInclude = {
    fromStore: { select: { id: true, name: true } },
    toStore: { select: { id: true, name: true } },
    user: { select: { fullName: true } },
    receivedBy: { select: { fullName: true } },
    items: { include: { variant: { include: { product: true } } } },
    adjustments: {
      include: { adjustedBy: { select: { fullName: true } } },
      orderBy: { adjustedAt: 'asc' as const },
    },
  } as const;

  type FullRow = Prisma.DeliveryGetPayload<{ include: typeof fullInclude }>;

  function rowToDTO(row: FullRow): DeliveryWithItems {
    return {
      id: row.id,
      number: row.number,
      kind: KIND_FROM_PRISMA[row.kind],
      status: STATUS_FROM_PRISMA[row.status],
      title: row.title,
      fromStoreId: row.fromStoreId,
      fromStoreName: row.fromStore?.name ?? null,
      toStoreId: row.toStoreId,
      toStoreName: row.toStore.name,
      createdByUserId: row.createdByUserId,
      createdByFullName: row.user.fullName,
      receivedByUserId: row.receivedByUserId,
      receivedByFullName: row.receivedBy?.fullName ?? null,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
      receivedAt: row.receivedAt?.toISOString() ?? null,
      itemCount: row.items.length,
      totalUnits: row.items.reduce((sum, i) => sum + i.quantity, 0),
      items: row.items.map((i) => ({
        id: i.id,
        variantId: i.variantId,
        quantity: i.quantity,
        receivedQuantity: i.receivedQuantity,
        productId: i.variant.productId,
        productCode: i.variant.product.code,
        productName: i.variant.product.name,
        size: SIZE_FROM_PRISMA[i.variant.size],
        color: i.variant.color,
        barcode: i.variant.barcode,
        imagePath: i.variant.imagePath,
      })),
      adjustments: row.adjustments.map((a) => ({
        id: a.id,
        deliveryItemId: a.deliveryItemId,
        expectedQty: a.expectedQty,
        actualQty: a.actualQty,
        reason: a.reason,
        adjustedByUserId: a.adjustedByUserId,
        adjustedByFullName: a.adjustedBy.fullName,
        adjustedAt: a.adjustedAt.toISOString(),
      })),
    };
  }

  return {
    async findActiveWarehouse(tx) {
      const c = tx ?? db;
      const wh = await c.store.findFirst({
        where: { kind: 'warehouse', isActive: true, deletedAt: null },
        select: { id: true },
      });
      return wh ?? null;
    },

    async variantsExistAndActive(variantIds, tx) {
      const c = tx ?? db;
      if (variantIds.length === 0) return new Set();
      const rows = await c.variant.findMany({
        where: { id: { in: variantIds }, deletedAt: null, isActive: true },
        select: { id: true },
      });
      return new Set(rows.map((r) => r.id));
    },

    async loadStockForVariants(storeId, variantIds, tx) {
      const rows = await tx.stockBySite.findMany({
        where: { storeId, variantId: { in: variantIds } },
        select: { variantId: true, quantity: true },
      });
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.variantId, r.quantity);
      return map;
    },

    async decrementStock(storeId, variantId, qty, tx) {
      const updated = await tx.stockBySite.update({
        where: { variantId_storeId: { variantId, storeId } },
        data: { quantity: { decrement: qty } },
        select: { quantity: true },
      });
      return updated.quantity;
    },

    async incrementStock(storeId, variantId, qty, tx) {
      const updated = await tx.stockBySite.upsert({
        where: { variantId_storeId: { variantId, storeId } },
        create: { variantId, storeId, quantity: qty },
        update: { quantity: { increment: qty } },
        select: { quantity: true },
      });
      return updated.quantity;
    },

    async createMovement(input, tx) {
      await tx.stockMovement.create({
        data: {
          storeId: input.storeId,
          variantId: input.variantId,
          userId: input.userId,
          type: input.type,
          payload: input.payload as Prisma.InputJsonValue,
        },
      });
    },

    async createDelivery(header, items, tx) {
      const now = header.receivedAtNow ? new Date() : null;
      const created = await tx.delivery.create({
        data: {
          kind: KIND_TO_PRISMA[header.kind],
          status: STATUS_TO_PRISMA[header.status],
          title: header.title,
          fromStoreId: header.fromStoreId,
          toStoreId: header.toStoreId,
          createdByUserId: header.createdByUserId,
          note: header.note,
          sentAt: now,
          receivedAt: now,
          // Lines created at first save get receivedQuantity matching quantity
          // *only* when the delivery is born `received` (legacy reception flow).
          // For draft/sent flows, receivedQuantity stays null until reception.
          items: {
            create: items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
              receivedQuantity: header.status === 'received' ? i.quantity : null,
            })),
          },
        },
        select: { id: true },
      });
      return { id: created.id };
    },

    async loadForUpdate(deliveryId, tx) {
      const row = await tx.delivery.findUnique({
        where: { id: deliveryId },
        select: {
          id: true,
          status: true,
          kind: true,
          title: true,
          fromStoreId: true,
          toStoreId: true,
          items: {
            select: { id: true, variantId: true, quantity: true, receivedQuantity: true },
          },
        },
      });
      if (!row) return null;
      return {
        id: row.id,
        status: STATUS_FROM_PRISMA[row.status],
        kind: KIND_FROM_PRISMA[row.kind],
        title: row.title,
        fromStoreId: row.fromStoreId,
        toStoreId: row.toStoreId,
        items: row.items,
      };
    },

    async updateDraftHeader(deliveryId, patch, tx) {
      await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
        },
      });
    },

    async replaceDraftItems(deliveryId, items, tx) {
      await tx.deliveryItem.deleteMany({ where: { deliveryId } });
      if (items.length === 0) return;
      await tx.deliveryItem.createMany({
        data: items.map((i) => ({
          deliveryId,
          variantId: i.variantId,
          quantity: i.quantity,
          receivedQuantity: null,
        })),
      });
    },

    async setStatus(deliveryId, status, timestamps, receivedByUserId, tx) {
      await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: STATUS_TO_PRISMA[status],
          ...(timestamps.sentAt ? { sentAt: timestamps.sentAt } : {}),
          ...(timestamps.receivedAt ? { receivedAt: timestamps.receivedAt } : {}),
          ...(receivedByUserId !== null ? { receivedByUserId } : {}),
        },
      });
    },

    async setReceivedQuantity(deliveryItemId, receivedQuantity, tx) {
      await tx.deliveryItem.update({
        where: { id: deliveryItemId },
        data: { receivedQuantity },
      });
    },

    async recordAdjustments(deliveryId, rows, tx) {
      if (rows.length === 0) return;
      await tx.deliveryItemAdjustment.createMany({
        data: rows.map((r) => ({
          deliveryId,
          deliveryItemId: r.deliveryItemId,
          expectedQty: r.expectedQty,
          actualQty: r.actualQty,
          reason: r.reason,
          adjustedByUserId: r.adjustedByUserId,
        })),
      });
    },

    async findDelivery(deliveryId) {
      const row = await db.delivery.findUnique({
        where: { id: deliveryId },
        include: fullInclude,
      });
      return row ? rowToDTO(row) : null;
    },

    async list(storeId, query) {
      const where: Prisma.DeliveryWhereInput = { toStoreId: storeId };
      if (query.status && query.status.length > 0) {
        where.status = { in: query.status.map((s) => STATUS_TO_PRISMA[s]) };
      }
      if (query.q) {
        const upper = query.q.toUpperCase();
        const ci = query.q;
        where.OR = [
          { title: { contains: ci, mode: 'insensitive' } },
          {
            items: {
              some: {
                variant: {
                  OR: [
                    { product: { code: { contains: upper } } },
                    { product: { name: { contains: ci, mode: 'insensitive' } } },
                    { barcode: { contains: upper } },
                  ],
                },
              },
            },
          },
        ];
      }

      const skip = (query.page - 1) * query.pageSize;
      const [rows, total] = await Promise.all([
        db.delivery.findMany({
          where,
          include: {
            fromStore: { select: { name: true } },
            toStore: { select: { name: true } },
            user: { select: { fullName: true } },
            receivedBy: { select: { fullName: true } },
            items: { select: { quantity: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.pageSize,
        }),
        db.delivery.count({ where }),
      ]);

      return {
        items: rows.map((row) => ({
          id: row.id,
          number: row.number,
          kind: KIND_FROM_PRISMA[row.kind],
          status: STATUS_FROM_PRISMA[row.status],
          title: row.title,
          fromStoreId: row.fromStoreId,
          fromStoreName: row.fromStore?.name ?? null,
          toStoreId: row.toStoreId,
          toStoreName: row.toStore.name,
          createdByUserId: row.createdByUserId,
          createdByFullName: row.user.fullName,
          receivedByUserId: row.receivedByUserId,
          receivedByFullName: row.receivedBy?.fullName ?? null,
          note: row.note,
          createdAt: row.createdAt.toISOString(),
          sentAt: row.sentAt?.toISOString() ?? null,
          receivedAt: row.receivedAt?.toISOString() ?? null,
          itemCount: row.items.length,
          totalUnits: row.items.reduce((sum, i) => sum + i.quantity, 0),
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async listGroupedByProduct(storeId, query) {
      const where: Prisma.DeliveryItemWhereInput = {
        delivery: { toStoreId: storeId },
        variant: {
          deletedAt: null,
          product: { deletedAt: null },
        },
      };
      if (query.q) {
        const upper = query.q.toUpperCase();
        const ci = query.q;
        where.variant = {
          deletedAt: null,
          product: { deletedAt: null },
          OR: [
            { product: { code: { contains: upper } } },
            { product: { name: { contains: ci, mode: 'insensitive' } } },
            { barcode: { contains: upper } },
          ],
        };
      }

      const rows = await db.deliveryItem.findMany({
        where,
        include: { variant: { include: { product: true } }, delivery: { select: { id: true } } },
      });

      const map = new Map<
        string,
        {
          productId: string;
          productCode: string;
          productName: string;
          imagePath: string | null;
          totalUnits: number;
          deliveryIds: Set<string>;
        }
      >();
      for (const it of rows) {
        const productId = it.variant.productId;
        const existing = map.get(productId);
        if (!existing) {
          map.set(productId, {
            productId,
            productCode: it.variant.product.code,
            productName: it.variant.product.name,
            imagePath: it.variant.imagePath,
            totalUnits: it.quantity,
            deliveryIds: new Set([it.delivery.id]),
          });
        } else {
          existing.totalUnits += it.quantity;
          existing.deliveryIds.add(it.delivery.id);
          if (!existing.imagePath && it.variant.imagePath) {
            existing.imagePath = it.variant.imagePath;
          }
        }
      }

      const items: DeliveryGroupedItem[] = Array.from(map.values())
        .map((g) => ({
          productId: g.productId,
          productCode: g.productCode,
          productName: g.productName,
          imagePath: g.imagePath,
          totalUnits: g.totalUnits,
          deliveryCount: g.deliveryIds.size,
        }))
        .sort((a, b) => a.productCode.localeCompare(b.productCode));

      const start = (query.page - 1) * query.pageSize;
      return {
        items: items.slice(start, start + query.pageSize),
        total: items.length,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async runSerializable(fn) {
      return db.$transaction((tx) => fn(tx as DeliveryTx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  };
}
