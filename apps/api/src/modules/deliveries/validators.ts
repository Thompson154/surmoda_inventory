import { z } from 'zod';

const NOTE_MAX = 500;
const QUANTITY_MAX = 100_000;

export const CreateDeliverySchema = z
  .object({
    items: z
      .array(
        z.object({
          variantId: z.string().min(1),
          quantity: z.coerce.number().int().min(1).max(QUANTITY_MAX),
        }),
      )
      .min(1, 'Al menos un ítem es requerido'),
    note: z.string().trim().max(NOTE_MAX).optional(),
  })
  .strict();

export type CreateDeliveryInput = z.infer<typeof CreateDeliverySchema>;

export const ListDeliveriesQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListDeliveriesInput = z.infer<typeof ListDeliveriesQuerySchema>;
