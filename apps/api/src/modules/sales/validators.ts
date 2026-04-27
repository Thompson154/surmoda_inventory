import { z } from 'zod';

const QUANTITY_MAX = 100_000;
// Cap on a per-line subtotal so a hostile / buggy client can't push billion-cents
// values into the DB. Aligns with PRICE_MAX_CENTS in products/validators.ts.
const SUBTOTAL_MAX_CENTS = 1_000_000_000;

const PaymentMethodEnum = z.enum(['qr', 'card', 'cash']);

export const CreateSaleSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            variantId: z.string().min(1).max(64),
            quantity: z.coerce.number().int().min(1).max(QUANTITY_MAX),
            // Optional. If omitted the BE defaults to qty * catalog price.
            // Service caps subtotal ≤ qty * unitPrice (no markup).
            subtotalCents: z.coerce.number().int().min(0).max(SUBTOTAL_MAX_CENTS).optional(),
          })
          .strict(),
      )
      .min(1, 'Al menos un ítem es requerido')
      .max(200, 'Máximo 200 ítems por venta'),
    paymentMethod: PaymentMethodEnum,
    /** Tier 3.A.3 — UUID v4 from the FE. Optional today (back-compat with
     *  FE versions pre-T3); enforced once every caller adopts it. */
    idempotencyKey: z.string().uuid().optional(),
  })
  .strict();

export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;

export const ListSalesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export type ListSalesInput = z.infer<typeof ListSalesQuerySchema>;
