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
