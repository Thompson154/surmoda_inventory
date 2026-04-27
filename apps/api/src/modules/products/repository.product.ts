import { Prisma } from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import type { ListProductsQuery, PaginatedProducts, ProductDTO } from './types';

export interface CreateProductPersistInput {
  code: string;
  name: string;
  description?: string | null;
}

export interface UpdateProductPersistInput {
  code?: string;
  name?: string;
  description?: string | null;
}

export type ProductTx = Prisma.TransactionClient;

export interface ProductRepository {
  findById(id: string, tx?: ProductTx): Promise<ProductDTO | null>;
  findByCode(code: string, tx?: ProductTx): Promise<ProductDTO | null>;
  list(query: ListProductsQuery): Promise<PaginatedProducts>;
  create(input: CreateProductPersistInput, tx?: ProductTx): Promise<ProductDTO>;
  update(id: string, input: UpdateProductPersistInput, tx?: ProductTx): Promise<ProductDTO>;
  setActive(id: string, isActive: boolean, tx?: ProductTx): Promise<ProductDTO>;
  countActiveVariants(productId: string, tx?: ProductTx): Promise<number>;
  runSerializable<T>(fn: (tx: ProductTx) => Promise<T>): Promise<T>;
}

export function buildProductRepository(db: Database): ProductRepository {
  function client(tx?: ProductTx): ProductTx | Database {
    return tx ?? db;
  }

  return {
    async findById(id, tx) {
      const product = await client(tx).product.findFirst({
        where: { id, deletedAt: null },
      });
      return product ? toProductDTO(product) : null;
    },

    async findByCode(code, tx) {
      const product = await client(tx).product.findFirst({
        where: { code, deletedAt: null },
      });
      return product ? toProductDTO(product) : null;
    },

    async list(query) {
      const where: Prisma.ProductWhereInput = { deletedAt: null };

      if (query.q) {
        const q = query.q;
        where.OR = [
          { code: { contains: q.toUpperCase() } },
          { name: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (query.isActive !== undefined) where.isActive = query.isActive;

      const skip = (query.page - 1) * query.pageSize;

      const [items, total] = await Promise.all([
        db.product.findMany({
          where,
          orderBy: [{ code: 'asc' }],
          skip,
          take: query.pageSize,
          include: {
            _count: { select: { variants: { where: { deletedAt: null } } } },
            // Una sola variante activa por producto para resolver la miniatura
            // del catálogo admin sin un fetch extra por fila. Orden por createdAt
            // asc para que sea estable: la primera variante creada es la "cara"
            // del producto. take:1 mantiene la query barata.
            variants: {
              where: { deletedAt: null, isActive: true, imagePath: { not: null } },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { imagePath: true },
            },
          },
        }),
        db.product.count({ where }),
      ]);

      return {
        items: items.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          isActive: p.isActive,
          variantsCount: p._count.variants,
          representativeImagePath: p.variants[0]?.imagePath ?? null,
          createdAt: p.createdAt.toISOString(),
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async create(input, tx) {
      const created = await client(tx).product.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          isActive: true,
        },
      });
      return toProductDTO(created);
    },

    async update(id, input, tx) {
      const data: Prisma.ProductUpdateInput = {};
      if (input.code !== undefined) data.code = input.code;
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;

      const updated = await client(tx).product.update({ where: { id }, data });
      return toProductDTO(updated);
    },

    async setActive(id, isActive, tx) {
      const updated = await client(tx).product.update({
        where: { id },
        data: { isActive },
      });
      return toProductDTO(updated);
    },

    async countActiveVariants(productId, tx) {
      return client(tx).variant.count({
        where: { productId, isActive: true, deletedAt: null },
      });
    },

    async runSerializable(fn) {
      return db.$transaction((tx) => fn(tx as ProductTx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  };
}

interface ProductRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toProductDTO(row: ProductRow): ProductDTO {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
