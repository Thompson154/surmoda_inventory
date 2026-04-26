import { z } from 'zod';

const QUANTITY_MAX = 100_000;

const PaymentMethodEnum = z.enum(['qr', 'card', 'cash']);

export const CreateSaleSchema = z
  .object({
    items: z
      .array(
        z.object({
          variantId: z.string().min(1),
          quantity: z.coerce.number().int().min(1).max(QUANTITY_MAX),
        }),
      )
      .min(1, 'Al menos un ítem es requerido'),
    paymentMethod: PaymentMethodEnum,
  })
  .strict();

export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;

export const ListSalesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListSalesInput = z.infer<typeof ListSalesQuerySchema>;
