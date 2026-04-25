import { z } from 'zod';

const STORE_CODE_REGEX = /^[A-Z0-9_]+$/;
const STORE_CODE_MIN = 2;
const STORE_CODE_MAX = 20;
const STORE_NAME_MIN = 2;
const STORE_NAME_MAX = 80;

const StoreKindEnum = z.enum(['warehouse', 'branch']);

export const CreateStoreSchema = z.object({
  code: z
    .string()
    .trim()
    .min(STORE_CODE_MIN)
    .max(STORE_CODE_MAX)
    .regex(STORE_CODE_REGEX, 'Código debe ser mayúsculas, números o guion bajo'),
  name: z.string().trim().min(STORE_NAME_MIN).max(STORE_NAME_MAX),
  kind: StoreKindEnum,
});

export type CreateStoreInput = z.infer<typeof CreateStoreSchema>;

// WHY: `kind` intentionally NOT included — kind immutability (FR-8 / ADR-003).
export const UpdateStoreSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(STORE_CODE_MIN)
      .max(STORE_CODE_MAX)
      .regex(STORE_CODE_REGEX)
      .optional(),
    name: z.string().trim().min(STORE_NAME_MIN).max(STORE_NAME_MAX).optional(),
  })
  .strict()
  .refine((d) => d.code !== undefined || d.name !== undefined, {
    message: 'Al menos un campo es requerido',
  });

export type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;

const booleanFromQuery = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true'));

export const ListStoresQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  kind: StoreKindEnum.optional(),
  isActive: booleanFromQuery.optional(),
  includeInactive: booleanFromQuery.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListStoresInput = z.infer<typeof ListStoresQuerySchema>;
