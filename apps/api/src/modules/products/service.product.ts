import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { generateBarcode } from './barcode';
import type { ProductRepository } from './repository.product';
import type {
  CreateProductDTO,
  ListProductsQuery,
  PaginatedProducts,
  ProductDTO,
  ProductWithVariantsDTO,
  UpdateProductDTO,
} from './types';
import type { VariantRepository } from './repository.variant';

export interface ProductServiceDeps {
  products: ProductRepository;
  variants: VariantRepository;
}

export interface ProductService {
  create(input: CreateProductDTO): Promise<ProductDTO>;
  list(query: ListProductsQuery): Promise<PaginatedProducts>;
  getById(id: string, includeInactiveVariants?: boolean): Promise<ProductWithVariantsDTO>;
  update(id: string, input: UpdateProductDTO): Promise<ProductDTO>;
  deactivate(id: string): Promise<ProductDTO>;
  reactivate(id: string): Promise<ProductDTO>;
}

export function buildProductService({ products, variants }: ProductServiceDeps): ProductService {
  function mapDuplicateCode(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, ERROR_CODES.PRODUCT_DUPLICATE_CODE, 'Ese código ya está en uso.');
    }
    throw err;
  }

  return {
    async create(input) {
      const code = input.code.toUpperCase();
      try {
        return await products.create({
          code,
          name: input.name,
          description: input.description ?? null,
        });
      } catch (err) {
        mapDuplicateCode(err);
      }
    },

    async list(query) {
      return products.list(query);
    },

    async getById(id, includeInactiveVariants = false) {
      const product = await products.findById(id);
      if (!product) {
        throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND, 'Producto no encontrado.');
      }
      const variantList = includeInactiveVariants
        ? await variants.listAllByProduct(id)
        : await variants.listActiveByProduct(id);
      return { ...product, variants: variantList };
    },

    async update(id, input) {
      const current = await products.findById(id);
      if (!current) {
        throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND, 'Producto no encontrado.');
      }

      const data: UpdateProductDTO = {};
      if (input.code !== undefined) data.code = input.code.toUpperCase();
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;

      const newCode = data.code;
      const codeChanging = newCode !== undefined && newCode !== current.code;

      // Code is part of the deterministic barcode hash — when it changes we
      // MUST regenerate barcodes for every active variant of this product so
      // the printed labels keep matching the DB. Wrap in a serializable tx so
      // either both writes land or neither.
      return products.runSerializable(async (tx) => {
        try {
          const updated = await products.update(id, data, tx);

          if (codeChanging) {
            const activeVariants = await variants.listActiveByProduct(id, tx);
            if (activeVariants.length > 0) {
              const map: Record<string, string> = {};
              for (const v of activeVariants) {
                map[v.id] = generateBarcode(updated.code, v.size, v.color);
              }
              await variants.bulkUpdateBarcodes(id, map, tx);
            }
          }

          return updated;
        } catch (err) {
          mapDuplicateCode(err);
        }
      });
    },

    async deactivate(id) {
      return products.runSerializable(async (tx) => {
        const product = await products.findById(id, tx);
        if (!product) {
          throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND, 'Producto no encontrado.');
        }
        if (!product.isActive) return product;

        const activeVariantsCount = await products.countActiveVariants(id, tx);
        if (activeVariantsCount > 0) {
          throw new AppError(
            409,
            ERROR_CODES.PRODUCT_HAS_ACTIVE_VARIANTS,
            `Hay ${activeVariantsCount} variante(s) activas. Desactivá las variantes primero.`,
            { activeVariantsCount },
          );
        }

        return products.setActive(id, false, tx);
      });
    },

    async reactivate(id) {
      const product = await products.findById(id);
      if (!product) {
        throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND, 'Producto no encontrado.');
      }
      if (product.isActive) return product;
      return products.setActive(id, true);
    },
  };
}
