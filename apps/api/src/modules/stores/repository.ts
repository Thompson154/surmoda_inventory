import { Prisma, type StoreKind as PrismaStoreKind } from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import type { ListStoresQuery, PaginatedStores, StoreDTO, StoreKind } from './types';

export interface CreateStorePersistInput {
  code: string;
  name: string;
  kind: StoreKind;
}

export interface UpdateStorePersistInput {
  code?: string;
  name?: string;
}

export type StoreTx = Prisma.TransactionClient;

export interface StoreRepository {
  findById(id: string, tx?: StoreTx): Promise<StoreDTO | null>;
  findByCode(code: string, tx?: StoreTx): Promise<StoreDTO | null>;
  list(query: ListStoresQuery, allowedIds?: string[]): Promise<PaginatedStores>;
  create(input: CreateStorePersistInput, tx?: StoreTx): Promise<StoreDTO>;
  update(id: string, input: UpdateStorePersistInput): Promise<StoreDTO>;
  setActive(id: string, isActive: boolean, tx?: StoreTx): Promise<StoreDTO>;
  countActiveAssignments(storeId: string, tx?: StoreTx): Promise<number>;
  countActiveWarehouses(opts?: { excludeId?: string }, tx?: StoreTx): Promise<number>;
  runSerializable<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T>;
}

export function buildStoreRepository(db: Database): StoreRepository {
  function client(tx?: StoreTx): StoreTx | Database {
    return tx ?? db;
  }

  return {
    async findById(id, tx) {
      const store = await client(tx).store.findFirst({
        where: { id, deletedAt: null },
      });
      return store ? toStoreDTO(store) : null;
    },

    async findByCode(code, tx) {
      const store = await client(tx).store.findFirst({
        where: { code, deletedAt: null },
      });
      return store ? toStoreDTO(store) : null;
    },

    async list(query, allowedIds) {
      const where: Prisma.StoreWhereInput = { deletedAt: null };

      if (query.q) {
        const q = query.q;
        where.OR = [
          { code: { contains: q.toUpperCase() } },
          { name: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (query.kind) where.kind = query.kind as PrismaStoreKind;
      if (query.isActive !== undefined) where.isActive = query.isActive;
      if (allowedIds !== undefined) {
        if (allowedIds.length === 0) {
          return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
        }
        where.id = { in: allowedIds };
      }

      const skip = (query.page - 1) * query.pageSize;

      const [items, total] = await Promise.all([
        db.store.findMany({
          where,
          orderBy: [{ kind: 'asc' }, { code: 'asc' }],
          skip,
          take: query.pageSize,
        }),
        db.store.count({ where }),
      ]);

      return {
        items: items.map(toStoreDTO),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async create(input, tx) {
      const created = await client(tx).store.create({
        data: {
          code: input.code,
          name: input.name,
          kind: input.kind as PrismaStoreKind,
          isActive: true,
        },
      });
      return toStoreDTO(created);
    },

    async update(id, input) {
      const data: Prisma.StoreUpdateInput = {};
      if (input.code !== undefined) data.code = input.code;
      if (input.name !== undefined) data.name = input.name;

      const updated = await db.store.update({ where: { id }, data });
      return toStoreDTO(updated);
    },

    async setActive(id, isActive, tx) {
      const updated = await client(tx).store.update({
        where: { id },
        data: { isActive },
      });
      return toStoreDTO(updated);
    },

    async countActiveAssignments(storeId, tx) {
      return client(tx).userStore.count({
        where: { storeId, deletedAt: null },
      });
    },

    async countActiveWarehouses(opts, tx) {
      const where: Prisma.StoreWhereInput = {
        kind: 'warehouse',
        isActive: true,
        deletedAt: null,
      };
      if (opts?.excludeId) where.id = { not: opts.excludeId };
      return client(tx).store.count({ where });
    },

    async runSerializable(fn) {
      // WHY: Serializable prevents the count-then-insert race for the single-warehouse invariant
      // (ADR-001). Trade-off: occasional retry on conflict — acceptable on admin-only low-volume endpoints.
      return db.$transaction((tx) => fn(tx as StoreTx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  };
}

interface StoreRow {
  id: string;
  code: string;
  name: string;
  kind: PrismaStoreKind;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toStoreDTO(row: StoreRow): StoreDTO {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind as StoreKind,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
