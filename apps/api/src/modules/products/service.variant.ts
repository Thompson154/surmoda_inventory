import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { generateBarcode } from './barcode';
import type { ProductRepository } from './repository.product';
import type { VariantRepository } from './repository.variant';
import type { CreateVariantDTO, UpdateVariantDTO, VariantDTO } from './types';
import type { ImageStorage, UploadInput } from './imageStorage';
import { ALLOWED_MIME_TYPES, MAX_IMAGE_BYTES } from './imageStorage';

export interface VariantServiceDeps {
  products: ProductRepository;
  variants: VariantRepository;
  imageStorage: ImageStorage;
}

export interface VariantService {
  create(productId: string, input: CreateVariantDTO, image?: UploadInput): Promise<VariantDTO>;
  update(id: string, input: UpdateVariantDTO, image?: UploadInput): Promise<VariantDTO>;
  deactivate(id: string): Promise<VariantDTO>;
  reactivate(id: string): Promise<VariantDTO>;
}

export function buildVariantService({
  products,
  variants,
  imageStorage,
}: VariantServiceDeps): VariantService {
  function validateImage(image: UploadInput) {
    if (image.buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new AppError(
        400,
        ERROR_CODES.VARIANT_IMAGE_TOO_LARGE,
        'La imagen supera el tamaño máximo permitido.',
      );
    }
    if (!ALLOWED_MIME_TYPES.has(image.mimetype)) {
      throw new AppError(
        400,
        ERROR_CODES.VARIANT_IMAGE_INVALID_TYPE,
        'Formato de imagen inválido (PNG, JPG o WebP).',
      );
    }
  }

  function mapVariantPersistError(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(',') ?? '';
      if (target.includes('barcode')) {
        throw new AppError(409, ERROR_CODES.BARCODE_COLLISION, 'Conflicto de código de barras.');
      }
      throw new AppError(
        409,
        ERROR_CODES.VARIANT_DUPLICATE_TUPLE,
        'Ya existe una variante con esa talla y color.',
      );
    }
    throw err;
  }

  return {
    async create(productId, input, image) {
      if (image) validateImage(image);

      return products.runSerializable(async (tx) => {
        const product = await products.findById(productId, tx);
        if (!product || !product.isActive) {
          throw new AppError(
            404,
            ERROR_CODES.VARIANT_PRODUCT_NOT_FOUND,
            'El producto no existe o está inactivo.',
          );
        }

        const color = input.color.trim();

        // WHY: pre-check makes the friendlier error code (VARIANT_DUPLICATE_TUPLE) win
        // over BARCODE_COLLISION, which would otherwise trigger first because barcodes
        // are deterministic over (code, size, color).
        const existingTuple = await variants.findActiveByTuple(productId, input.size, color, tx);
        if (existingTuple) {
          throw new AppError(
            409,
            ERROR_CODES.VARIANT_DUPLICATE_TUPLE,
            'Ya existe una variante con esa talla y color.',
          );
        }

        const barcode = generateBarcode(product.code, input.size, color);

        let imagePath: string | undefined;
        if (image) {
          imagePath = await imageStorage.save(image, {
            productCode: product.code,
            size: input.size,
            color,
          });
        }

        try {
          return await variants.create(
            {
              productId,
              size: input.size,
              color,
              barcode,
              priceCents: input.priceCents,
              imagePath,
            },
            tx,
          );
        } catch (err) {
          mapVariantPersistError(err);
        }
      });
    },

    async update(id, input, image) {
      if (image) validateImage(image);

      const current = await variants.findById(id);
      if (!current) {
        throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND, 'Variante no encontrada.');
      }

      let imagePath: string | undefined;
      if (image) {
        const product = await products.findById(current.productId);
        if (!product) {
          throw new AppError(
            404,
            ERROR_CODES.VARIANT_PRODUCT_NOT_FOUND,
            'El producto no existe o está inactivo.',
          );
        }
        imagePath = await imageStorage.save(image, {
          productCode: product.code,
          size: current.size,
          color: current.color,
        });
      }

      return variants.update(id, {
        priceCents: input.priceCents,
        imagePath,
      });
    },

    async deactivate(id) {
      const current = await variants.findById(id);
      if (!current) {
        throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND, 'Variante no encontrada.');
      }
      if (!current.isActive) return current;
      return variants.setActive(id, false);
    },

    async reactivate(id) {
      const current = await variants.findById(id);
      if (!current) {
        throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND, 'Variante no encontrada.');
      }
      if (current.isActive) return current;
      return variants.setActive(id, true);
    },
  };
}
