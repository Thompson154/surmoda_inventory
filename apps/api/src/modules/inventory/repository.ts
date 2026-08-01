import { Prisma, type StockMovementType as PrismaStockMovementType } from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import { SIZE_FROM_PRISMA } from '../../shared/enums/mappings';
import type {
  InventoryRowDTO,
  ListInventoryQuery,
  ListMovementsQuery,
  PaginatedGroupedInventory,
  PaginatedInventory,
  PaginatedStockMovements,
  StockMovementPayload,
  StockMovementType,
  StoreEditPermissionDTO,
} from './types';

export type InventoryTx = Prisma.TransactionClient;

const MOVEMENT_TYPE_FROM_PRISMA: Record<PrismaStockMovementType, StockMovementType> = {
  adjusted: 'adjusted',
  edit_permission_toggled: 'edit_permission_toggled',
  delivery_in: 'delivery_in',
  delivery_out: 'delivery_out',
  delivery_received_adjusted: 'delivery_received_adjusted',
  sale_out: 'sale_out',
  sale_return: 'sale_return',
};

const MOVEMENT_TYPE_TO_PRISMA: Record<StockMovementType, PrismaStockMovementType> = {
  adjusted: 'adjusted',
  edit_permission_toggled: 'edit_permission_toggled',
  delivery_in: 'delivery_in',
  delivery_out: 'delivery_out',
  delivery_received_adjusted: 'delivery_received_adjusted',
  sale_out: 'sale_out',
  sale_return: 'sale_return',
};

export interface UserAssignmentRow {
  userId: string;
  storeId: string;
  role: 'encargada' | 'vendedora';
}

export interface CreateMovementInput {
  storeId: string;
  variantId: string | null;
  userId: string;
  type: StockMovementType;
  payload: StockMovementPayload;
}

export interface InventoryRepository {
  findUserAssignment(
    userId: string,
    storeId: string,
    tx?: InventoryTx,
  ): Promise<UserAssignmentRow | null>;
  hasAnyEncargadaRole(userId: string, tx?: InventoryTx): Promise<boolean>;
  list(storeId: string, query: ListInventoryQuery): Promise<PaginatedInventory>;
  listGroupedByProduct(
    storeId: string,
    query: ListInventoryQuery,
  ): Promise<PaginatedGroupedInventory>;
  listVariantsForProductInStore(storeId: string, productId: string): Promise<InventoryRowDTO[]>;
  findRow(storeId: string, variantId: string, tx?: InventoryTx): Promise<InventoryRowDTO | null>;
  /** Lightweight existence check — prevents orphan stock rows on adjust. */
  findVariantById(variantId: string, tx?: InventoryTx): Promise<{ id: string } | null>;
  findByBarcode(
    storeId: string,
    barcode: string,
    tx?: InventoryTx,
  ): Promise<InventoryRowDTO | null>;
  upsertQuantity(
    storeId: string,
    variantId: string,
    quantity: number,
    tx: InventoryTx,
  ): Promise<{ previous: number; next: number }>;
  createMovement(input: CreateMovementInput, tx: InventoryTx): Promise<void>;
  listMovements(storeId: string, query: ListMovementsQuery): Promise<PaginatedStockMovements>;
  getEditPermission(storeId: string, tx?: InventoryTx): Promise<StoreEditPermissionDTO>;
  upsertEditPermission(
    storeId: string,
    isEnabled: boolean,
    userId: string,
    tx: InventoryTx,
  ): Promise<StoreEditPermissionDTO>;
  runSerializable<T>(fn: (tx: InventoryTx) => Promise<T>): Promise<T>;
}

export function buildInventoryRepository(db: Database): InventoryRepository {
  function client(tx?: InventoryTx): InventoryTx | Database {
    return tx ?? db;
  }

  async function loadInventoryRow(
    c: InventoryTx | Database,
    storeId: string,
    variantId: string,
  ): Promise<InventoryRowDTO | null> {
    const row = await c.stockBySite.findUnique({
      where: { variantId_storeId: { variantId, storeId } },
      include: { variant: { include: { product: true } } },
    });
    if (!row) return null;
    if (row.variant.deletedAt !== null) return null;
    return {
      variantId: row.variantId,
      productId: row.variant.productId,
      productCode: row.variant.product.code,
      productName: row.variant.product.name,
      size: SIZE_FROM_PRISMA[row.variant.size],
      color: row.variant.color,
      barcode: row.variant.barcode,
      priceCents: row.variant.priceCents,
      imagePath: row.variant.imagePath,
      quantity: row.quantity,
    };
  }

  return {
    async findUserAssignment(userId, storeId, tx) {
      const row = await client(tx).userStore.findFirst({
        where: { userId, storeId, deletedAt: null },
        select: { userId: true, storeId: true, role: true },
      });
      if (!row) return null;
      return {
        userId: row.userId,
        storeId: row.storeId,
        role: row.role as 'encargada' | 'vendedora',
      };
    },

    async hasAnyEncargadaRole(userId, tx) {
      const count = await client(tx).userStore.count({
        where: { userId, role: 'encargada', deletedAt: null },
      });
      return count > 0;
    },

    async listGroupedByProduct(storeId, query) {
      // Filter at the variant/product level via stockBySite, then aggregate per product.
      const variantWhere: Prisma.VariantWhereInput = {
        deletedAt: null,
        isActive: true,
        product: { deletedAt: null, isActive: true },
      };
      if (query.q) {
        const upper = query.q.toUpperCase();
        const ci = query.q;
        variantWhere.OR = [
          { product: { code: { contains: upper } } },
          { product: { name: { contains: ci, mode: 'insensitive' } } },
          { product: { description: { contains: ci, mode: 'insensitive' } } },
          { barcode: { contains: upper } },
        ];
      }
      if (query.size) {
        // Map contract size string back to the Prisma enum value.
        const SIZE_TO_PRISMA: Record<string, string> = {
          s: 's',
          m: 'm',
          l: 'l',
          xl: 'xl',
          xxl: 'xxl',
          '28': 'size_28',
          '30': 'size_30',
          '32': 'size_32',
          '34': 'size_34',
          standard: 'standard',
        };
        const prismaSize = SIZE_TO_PRISMA[query.size];
        if (prismaSize) {
          variantWhere.size = prismaSize as Prisma.VariantWhereInput['size'];
        }
      }
      if (query.color) {
        variantWhere.color = { contains: query.color, mode: 'insensitive' };
      }

      // Pull every matching stockBySite row + its variant + product, then aggregate in JS.
      // For a small catalog (≤ a few hundred products) this is the simplest path.
      const rows = await db.stockBySite.findMany({
        where: { storeId, variant: variantWhere },
        include: { variant: { include: { product: true } } },
      });

      const groupedMap = new Map<
        string,
        {
          productId: string;
          productCode: string;
          productName: string;
          imagePath: string | null;
          totalQuantity: number;
          variantsCount: number;
          lowVariantsCount: number;
          zeroVariantsCount: number;
          representativeBarcode: string | null;
        }
      >();

      const LOW_THRESHOLD = 5;
      for (const row of rows) {
        const productId = row.variant.productId;
        const isZero = row.quantity === 0;
        const isLow = !isZero && row.quantity <= LOW_THRESHOLD;
        const existing = groupedMap.get(productId);
        if (!existing) {
          groupedMap.set(productId, {
            productId,
            productCode: row.variant.product.code,
            productName: row.variant.product.name,
            imagePath: row.variant.imagePath,
            totalQuantity: row.quantity,
            variantsCount: 1,
            lowVariantsCount: isLow ? 1 : 0,
            zeroVariantsCount: isZero ? 1 : 0,
            representativeBarcode: row.variant.barcode,
          });
        } else {
          existing.totalQuantity += row.quantity;
          existing.variantsCount += 1;
          if (isLow) existing.lowVariantsCount += 1;
          if (isZero) existing.zeroVariantsCount += 1;
          if (!existing.imagePath && row.variant.imagePath) {
            existing.imagePath = row.variant.imagePath;
          }
        }
      }

      let items = Array.from(groupedMap.values()).sort((a, b) =>
        a.productCode.localeCompare(b.productCode),
      );
      // Filter at the GROUP level by checking the per-variant counters: a model
      // with three variants 100/100/1 should show up in "Stock bajo" because one
      // of its variants is at 1, even though the aggregate total is 201.
      if (query.stockStatus === 'zero') {
        items = items.filter((it) => it.zeroVariantsCount > 0);
      } else if (query.stockStatus === 'low') {
        items = items.filter((it) => it.lowVariantsCount > 0);
      }
      const total = items.length;
      const start = (query.page - 1) * query.pageSize;
      const paginated = items.slice(start, start + query.pageSize);

      return {
        items: paginated,
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async listVariantsForProductInStore(storeId, productId) {
      const rows = await db.stockBySite.findMany({
        where: {
          storeId,
          variant: {
            productId,
            deletedAt: null,
            isActive: true,
            product: { deletedAt: null, isActive: true },
          },
        },
        include: { variant: { include: { product: true } } },
        orderBy: [{ variant: { size: 'asc' } }, { variant: { color: 'asc' } }],
      });
      return rows.map((row) => ({
        variantId: row.variantId,
        productId: row.variant.productId,
        productCode: row.variant.product.code,
        productName: row.variant.product.name,
        size: SIZE_FROM_PRISMA[row.variant.size],
        color: row.variant.color,
        barcode: row.variant.barcode,
        priceCents: row.variant.priceCents,
        imagePath: row.variant.imagePath,
        quantity: row.quantity,
      }));
    },

    async list(storeId, query) {
      const where: Prisma.StockBySiteWhereInput = {
        storeId,
        variant: {
          deletedAt: null,
          isActive: true,
          product: { deletedAt: null, isActive: true },
        },
      };

      if (query.q) {
        const upper = query.q.toUpperCase();
        const ci = query.q;
        where.variant = {
          deletedAt: null,
          isActive: true,
          product: { deletedAt: null, isActive: true },
          OR: [
            { product: { code: { contains: upper } } },
            { product: { name: { contains: ci, mode: 'insensitive' } } },
            { product: { description: { contains: ci, mode: 'insensitive' } } },
            { barcode: { contains: upper } },
          ],
        };
      }

      const skip = (query.page - 1) * query.pageSize;
      const [rows, total] = await Promise.all([
        db.stockBySite.findMany({
          where,
          include: { variant: { include: { product: true } } },
          orderBy: [{ variant: { product: { code: 'asc' } } }, { variant: { size: 'asc' } }],
          skip,
          take: query.pageSize,
        }),
        db.stockBySite.count({ where }),
      ]);

      return {
        items: rows.map((row) => ({
          variantId: row.variantId,
          productId: row.variant.productId,
          productCode: row.variant.product.code,
          productName: row.variant.product.name,
          size: SIZE_FROM_PRISMA[row.variant.size],
          color: row.variant.color,
          barcode: row.variant.barcode,
          priceCents: row.variant.priceCents,
          imagePath: row.variant.imagePath,
          quantity: row.quantity,
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async findRow(storeId, variantId, tx) {
      return loadInventoryRow(client(tx), storeId, variantId);
    },

    async findVariantById(variantId, tx) {
      return client(tx).variant.findUnique({
        where: { id: variantId, deletedAt: null },
        select: { id: true },
      });
    },

    async findByBarcode(storeId, barcode, tx) {
      const v = await client(tx).variant.findFirst({
        where: { barcode, deletedAt: null },
        select: { id: true },
      });
      if (!v) return null;
      return loadInventoryRow(client(tx), storeId, v.id);
    },

    async upsertQuantity(storeId, variantId, quantity, tx) {
      const existing = await tx.stockBySite.findUnique({
        where: { variantId_storeId: { variantId, storeId } },
      });
      if (!existing) {
        await tx.stockBySite.create({
          data: { variantId, storeId, quantity },
        });
        return { previous: 0, next: quantity };
      }
      const previous = existing.quantity;
      await tx.stockBySite.update({
        where: { id: existing.id },
        data: { quantity },
      });
      return { previous, next: quantity };
    },

    async createMovement(input, tx) {
      await tx.stockMovement.create({
        data: {
          storeId: input.storeId,
          variantId: input.variantId,
          userId: input.userId,
          type: MOVEMENT_TYPE_TO_PRISMA[input.type],
          payload: input.payload as Prisma.InputJsonValue,
        },
      });
    },

    async listMovements(storeId, query) {
      const skip = (query.page - 1) * query.pageSize;
      const [rows, total] = await Promise.all([
        db.stockMovement.findMany({
          where: { storeId },
          include: {
            user: { select: { fullName: true } },
            // Incluimos product.name + variant.size/color para que el drawer
            // muestre identificación humana ("Polera azul · M") en lugar de
            // solo el código alfanumérico — sin un round-trip extra.
            variant: {
              select: {
                barcode: true,
                size: true,
                color: true,
                product: { select: { code: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.pageSize,
        }),
        db.stockMovement.count({ where: { storeId } }),
      ]);

      return {
        items: rows.map((row) => ({
          id: row.id,
          storeId: row.storeId,
          variantId: row.variantId,
          userId: row.userId,
          userFullName: row.user.fullName,
          type: MOVEMENT_TYPE_FROM_PRISMA[row.type],
          payload: (row.payload ?? {}) as StockMovementPayload,
          productCode: row.variant?.product.code ?? null,
          productName: row.variant?.product.name ?? null,
          barcode: row.variant?.barcode ?? null,
          variantSize: row.variant ? SIZE_FROM_PRISMA[row.variant.size] : null,
          variantColor: row.variant?.color ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async getEditPermission(storeId, tx) {
      const row = await client(tx).storeEditPermission.findUnique({ where: { storeId } });
      if (!row) {
        return { storeId, isEnabled: false, toggledByUserId: null, toggledAt: null };
      }
      return {
        storeId: row.storeId,
        isEnabled: row.isEnabled,
        toggledByUserId: row.toggledByUserId,
        toggledAt: row.toggledAt?.toISOString() ?? null,
      };
    },

    async upsertEditPermission(storeId, isEnabled, userId, tx) {
      const now = new Date();
      const upserted = await tx.storeEditPermission.upsert({
        where: { storeId },
        create: { storeId, isEnabled, toggledByUserId: userId, toggledAt: now },
        update: { isEnabled, toggledByUserId: userId, toggledAt: now },
      });
      return {
        storeId: upserted.storeId,
        isEnabled: upserted.isEnabled,
        toggledByUserId: upserted.toggledByUserId,
        toggledAt: upserted.toggledAt?.toISOString() ?? null,
      };
    },

    async runSerializable(fn) {
      return db.$transaction((tx) => fn(tx as InventoryTx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  };
}
