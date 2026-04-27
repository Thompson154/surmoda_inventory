import { z } from 'zod';
import { SIZE_VALUES, type Size } from '@surmoda/contracts';

const PRODUCT_CODE_REGEX = /^[A-Z0-9_]+$/;
const PRODUCT_CODE_MIN = 2;
const PRODUCT_CODE_MAX = 15;
const PRODUCT_NAME_MIN = 2;
const PRODUCT_NAME_MAX = 120;
const PRODUCT_DESCRIPTION_MAX = 500;
const COLOR_MAX = 32;
const PRICE_MIN_CENTS = 1;
const PRICE_MAX_CENTS = 10_000_000;

// WHY: cast preserves the literal `Size` union for downstream consumers.
const SizeEnum = z.enum(SIZE_VALUES as unknown as readonly [Size, ...Size[]]);

export const CreateProductSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(PRODUCT_CODE_MIN)
      .max(PRODUCT_CODE_MAX)
      .regex(PRODUCT_CODE_REGEX, 'Código debe ser mayúsculas, números o guion bajo'),
    name: z.string().trim().min(PRODUCT_NAME_MIN).max(PRODUCT_NAME_MAX),
    description: z.string().trim().max(PRODUCT_DESCRIPTION_MAX).optional(),
  })
  .strict();

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(PRODUCT_CODE_MIN)
      .max(PRODUCT_CODE_MAX)
      .regex(PRODUCT_CODE_REGEX)
      .optional(),
    name: z.string().trim().min(PRODUCT_NAME_MIN).max(PRODUCT_NAME_MAX).optional(),
    description: z.string().trim().max(PRODUCT_DESCRIPTION_MAX).optional(),
  })
  .strict()
  .refine((d) => d.code !== undefined || d.name !== undefined || d.description !== undefined, {
    message: 'Al menos un campo es requerido',
  });

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

const booleanFromQuery = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true'));

export const ListProductsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    isActive: booleanFromQuery.optional(),
    includeInactive: booleanFromQuery.optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export type ListProductsInput = z.infer<typeof ListProductsQuerySchema>;

// Multipart endpoints: numeric fields arrive as strings; coerce upfront.
export const CreateVariantSchema = z
  .object({
    size: SizeEnum,
    color: z.string().trim().min(1).max(COLOR_MAX),
    priceCents: z.coerce.number().int().min(PRICE_MIN_CENTS).max(PRICE_MAX_CENTS),
  })
  .strict();

export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;

export const UpdateVariantSchema = z
  .object({
    priceCents: z.coerce.number().int().min(PRICE_MIN_CENTS).max(PRICE_MAX_CENTS).optional(),
  })
  .strict()
  .refine((d) => d.priceCents !== undefined, {
    message: 'Al menos un campo es requerido',
  });

export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>;
