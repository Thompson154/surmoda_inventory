import { z } from 'zod';

const NOTE_MAX = 500;
const TITLE_MAX = 80;
const QUANTITY_MAX = 100_000;
const STATUS_VALUES = ['draft', 'sent', 'received', 'partial'] as const;

const ItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(QUANTITY_MAX),
});

export const CreateDeliverySchema = z
  .object({
    items: z.array(ItemSchema).min(1, 'Al menos un ítem es requerido'),
    note: z.string().trim().max(NOTE_MAX).optional(),
    title: z.string().trim().max(TITLE_MAX).optional(),
    asDraft: z.boolean().optional(),
  })
  .strict();

export type CreateDeliveryInput = z.infer<typeof CreateDeliverySchema>;

export const UpdateDraftDeliverySchema = z
  .object({
    title: z.string().trim().max(TITLE_MAX).optional(),
    note: z.string().trim().max(NOTE_MAX).optional(),
    items: z.array(ItemSchema).min(1).optional(),
  })
  .strict();

export type UpdateDraftDeliveryInput = z.infer<typeof UpdateDraftDeliverySchema>;

export const ConfirmDraftSchema = z
  .object({
    title: z.string().trim().max(TITLE_MAX).optional(),
  })
  .strict();

export type ConfirmDraftInput = z.infer<typeof ConfirmDraftSchema>;

export const ReceiveDeliverySchema = z
  .object({
    items: z
      .array(
        z.object({
          deliveryItemId: z.string().min(1),
          receivedQuantity: z.coerce.number().int().min(0).max(QUANTITY_MAX),
          reason: z.string().trim().max(NOTE_MAX).optional(),
        }),
      )
      .min(1),
  })
  .strict();

export type ReceiveDeliveryInput = z.infer<typeof ReceiveDeliverySchema>;

const PRODUCT_CODE_REGEX = /^[A-Z0-9_]{2,15}$/;
const SIZE_VALUES = ['s', 'm', 'l', 'xl', 'xxl', '28', '30', '32', '34', 'standard'] as const;
const COLOR_MAX = 32;
const PRICE_MIN_CENTS = 1;
const PRICE_MAX_CENTS = 10_000_000;
const PRODUCT_NAME_MAX = 120;

export const WarehouseIntakeSchema = z
  .object({
    productCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(PRODUCT_CODE_REGEX, 'Código debe ser 2..15 chars mayús/núm/guion bajo'),
    productName: z.string().trim().min(2).max(PRODUCT_NAME_MAX).optional(),
    title: z.string().trim().max(TITLE_MAX).optional(),
    note: z.string().trim().max(NOTE_MAX).optional(),
    variants: z
      .array(
        z.object({
          size: z.enum(SIZE_VALUES),
          color: z.string().trim().min(1).max(COLOR_MAX),
          quantity: z.coerce.number().int().min(1).max(QUANTITY_MAX),
          priceCents: z.coerce.number().int().min(PRICE_MIN_CENTS).max(PRICE_MAX_CENTS),
          imageBase64: z
            .string()
            .max(8 * 1024 * 1024) // ~6MB raw → safety cap on transport size
            .nullable()
            .optional(),
        }),
      )
      .min(1, 'Al menos una variante es requerida'),
  })
  .strict();

export type WarehouseIntakeInput = z.infer<typeof WarehouseIntakeSchema>;

export const ListDeliveriesQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z
    .union([
      z.enum(STATUS_VALUES),
      z.array(z.enum(STATUS_VALUES)).min(1),
    ])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListDeliveriesInput = z.infer<typeof ListDeliveriesQuerySchema>;
