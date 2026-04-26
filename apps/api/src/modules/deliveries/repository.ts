import {
  Prisma,
  type DeliveryKind as PrismaDeliveryKind,
} from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import { SIZE_FROM_PRISMA } from '../../shared/enums/mappings';
import type {
  DeliveryGroupedItem,
  DeliveryKind,
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

export interface CreateDeliveryHeaderInput {
  kind: DeliveryKind;
  fromStoreId: string | null;
  toStoreId: string;
  createdByUserId: string;
  note: string | null;
}

export interface CreateDeliveryItemRow {
  variantId: string;
  quantity: number;
}

export interface VariantStockRow {
  variantId: string;
  quantity: number;
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
      type: 'delivery_in' | 'delivery_out';
      payload: Record<string, unknown>;
    },
    tx: DeliveryTx,
  ): Promise<void>;
  createDelivery(header: CreateDeliveryHeaderInput, items: CreateDeliveryItemRow[], tx: DeliveryTx): Promise<{ id: string }>;
  findDelivery(deliveryId: string): Promise<DeliveryWithItems | null>;
  list(storeId: string, query: ListDeliveriesQuery): Promise<PaginatedDeliveries>;
  listGroupedByProduct(
    storeId: string,
    query: ListDeliveriesQuery,
  ): Promise<PaginatedDeliveryGroups>;
  runSerializable<T>(fn: (tx: DeliveryTx) => Promise<T>): Promise<T>;
}

export function buildDeliveryRepository(db: Database): DeliveryRepository {
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
      const created = await tx.delivery.create({
        data: {
          kind: KIND_TO_PRISMA[header.kind],
          fromStoreId: header.fromStoreId,
          toStoreId: header.toStoreId,
          createdByUserId: header.createdByUserId,
          note: header.note,
          items: { create: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) },
        },
        select: { id: true },
      });
      return { id: created.id };
    },

    async findDelivery(deliveryId) {
      const row = await db.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          fromStore: { select: { id: true, name: true } },
          toStore: { select: { id: true, name: true } },
          user: { select: { fullName: true } },
          items: {
            include: {
              variant: { include: { product: true } },
            },
          },
        },
      });
      if (!row) return null;
      const totalUnits = row.items.reduce((sum, i) => sum + i.quantity, 0);
      return {
        id: row.id,
        kind: KIND_FROM_PRISMA[row.kind],
        fromStoreId: row.fromStoreId,
        fromStoreName: row.fromStore?.name ?? null,
        toStoreId: row.toStoreId,
        toStoreName: row.toStore.name,
        createdByUserId: row.createdByUserId,
        createdByFullName: row.user.fullName,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
        itemCount: row.items.length,
        totalUnits,
        items: row.items.map((i) => ({
          id: i.id,
          variantId: i.variantId,
          quantity: i.quantity,
          productId: i.variant.productId,
          productCode: i.variant.product.code,
          productName: i.variant.product.name,
          size: SIZE_FROM_PRISMA[i.variant.size],
          color: i.variant.color,
          barcode: i.variant.barcode,
          imagePath: i.variant.imagePath,
        })),
      };
    },

    async list(storeId, query) {
      const where: Prisma.DeliveryWhereInput = { toStoreId: storeId };
      if (query.q) {
        const upper = query.q.toUpperCase();
        const ci = query.q;
        where.items = {
          some: {
            variant: {
              OR: [
                { product: { code: { contains: upper } } },
                { product: { name: { contains: ci, mode: 'insensitive' } } },
                { barcode: { contains: upper } },
              ],
            },
          },
        };
      }

      const skip = (query.page - 1) * query.pageSize;
      const [rows, total] = await Promise.all([
        db.delivery.findMany({
          where,
          include: {
            fromStore: { select: { name: true } },
            toStore: { select: { name: true } },
            user: { select: { fullName: true } },
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
          kind: KIND_FROM_PRISMA[row.kind],
          fromStoreId: row.fromStoreId,
          fromStoreName: row.fromStore?.name ?? null,
          toStoreId: row.toStoreId,
          toStoreName: row.toStore.name,
          createdByUserId: row.createdByUserId,
          createdByFullName: row.user.fullName,
          note: row.note,
          createdAt: row.createdAt.toISOString(),
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

