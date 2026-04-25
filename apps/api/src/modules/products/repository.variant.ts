import { Prisma, type Size as PrismaSize } from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import type { Size, VariantDTO } from './types';

export interface CreateVariantPersistInput {
  productId: string;
  size: Size;
  color: string;
  barcode: string;
  priceCents: number;
  imagePath?: string | null;
}

export interface UpdateVariantPersistInput {
  priceCents?: number;
  imagePath?: string | null;
}

export type VariantTx = Prisma.TransactionClient;

export interface VariantRepository {
  findById(id: string, tx?: VariantTx): Promise<VariantDTO | null>;
  findByBarcode(barcode: string, tx?: VariantTx): Promise<VariantDTO | null>;
  findActiveByTuple(
    productId: string,
    size: Size,
    color: string,
    tx?: VariantTx,
  ): Promise<VariantDTO | null>;
  listActiveByProduct(productId: string): Promise<VariantDTO[]>;
  listAllByProduct(productId: string): Promise<VariantDTO[]>;
  create(input: CreateVariantPersistInput, tx?: VariantTx): Promise<VariantDTO>;
  update(id: string, input: UpdateVariantPersistInput): Promise<VariantDTO>;
  setActive(id: string, isActive: boolean, tx?: VariantTx): Promise<VariantDTO>;
}

const SIZE_TO_PRISMA: Record<Size, PrismaSize> = {
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

const PRISMA_TO_SIZE: Record<PrismaSize, Size> = {
  s: 's',
  m: 'm',
  l: 'l',
  xl: 'xl',
  xxl: 'xxl',
  size_28: '28',
  size_30: '30',
  size_32: '32',
  size_34: '34',
  standard: 'standard',
};

export function buildVariantRepository(db: Database): VariantRepository {
  function client(tx?: VariantTx): VariantTx | Database {
    return tx ?? db;
  }

  return {
    async findById(id, tx) {
      const v = await client(tx).variant.findFirst({ where: { id, deletedAt: null } });
      return v ? toVariantDTO(v) : null;
    },

    async findByBarcode(barcode, tx) {
      const v = await client(tx).variant.findFirst({ where: { barcode, deletedAt: null } });
      return v ? toVariantDTO(v) : null;
    },

    async findActiveByTuple(productId, size, color, tx) {
      const v = await client(tx).variant.findFirst({
        where: {
          productId,
          size: SIZE_TO_PRISMA[size],
          color,
          deletedAt: null,
        },
      });
      return v ? toVariantDTO(v) : null;
    },

    async listActiveByProduct(productId) {
      const rows = await db.variant.findMany({
        where: { productId, isActive: true, deletedAt: null },
        orderBy: [{ size: 'asc' }, { color: 'asc' }],
      });
      return rows.map(toVariantDTO);
    },

    async listAllByProduct(productId) {
      const rows = await db.variant.findMany({
        where: { productId, deletedAt: null },
        orderBy: [{ size: 'asc' }, { color: 'asc' }],
      });
      return rows.map(toVariantDTO);
    },

    async create(input, tx) {
      const created = await client(tx).variant.create({
        data: {
          productId: input.productId,
          size: SIZE_TO_PRISMA[input.size],
          color: input.color,
          barcode: input.barcode,
          priceCents: input.priceCents,
          imagePath: input.imagePath ?? null,
          isActive: true,
        },
      });
      return toVariantDTO(created);
    },

    async update(id, input) {
      const data: Prisma.VariantUpdateInput = {};
      if (input.priceCents !== undefined) data.priceCents = input.priceCents;
      if (input.imagePath !== undefined) data.imagePath = input.imagePath;

      const updated = await db.variant.update({ where: { id }, data });
      return toVariantDTO(updated);
    },

    async setActive(id, isActive, tx) {
      const updated = await client(tx).variant.update({
        where: { id },
        data: { isActive },
      });
      return toVariantDTO(updated);
    },
  };
}

interface VariantRow {
  id: string;
  productId: string;
  size: PrismaSize;
  color: string;
  barcode: string;
  priceCents: number;
  imagePath: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toVariantDTO(row: VariantRow): VariantDTO {
  return {
    id: row.id,
    productId: row.productId,
    size: PRISMA_TO_SIZE[row.size],
    color: row.color,
    barcode: row.barcode,
    priceCents: row.priceCents,
    imagePath: row.imagePath,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
