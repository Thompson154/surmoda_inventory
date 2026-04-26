import { z } from 'zod';

const QUANTITY_MIN = 0;
const QUANTITY_MAX = 1_000_000;
const REASON_MAX = 200;

export const AdjustQuantitySchema = z
  .object({
    quantity: z.coerce.number().int().min(QUANTITY_MIN).max(QUANTITY_MAX),
    reason: z.string().trim().max(REASON_MAX).optional(),
  })
  .strict();

export type AdjustQuantityInput = z.infer<typeof AdjustQuantitySchema>;

export const TogglePermissionSchema = z
  .object({
    isEnabled: z.boolean(),
  })
  .strict();

export type TogglePermissionInput = z.infer<typeof TogglePermissionSchema>;

const STOCK_STATUS_VALUES = ['low', 'zero'] as const;
const SIZE_VALUES = ['s', 'm', 'l', 'xl', 'xxl', '28', '30', '32', '34', 'standard'] as const;

export const ListInventoryQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  /** Filter by aggregate stock state across all variants of the product. */
  stockStatus: z.enum(STOCK_STATUS_VALUES).optional(),
  /** Filter by variant size — keep at least one variant of that size with stock. */
  size: z.enum(SIZE_VALUES).optional(),
  /** Filter by variant color (case-insensitive substring). */
  color: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListInventoryInput = z.infer<typeof ListInventoryQuerySchema>;

export const ListMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListMovementsInput = z.infer<typeof ListMovementsQuerySchema>;
