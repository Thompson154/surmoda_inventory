import { z } from 'zod';

// WHY: Wave 5 — payment method enum aligned with Prisma PaymentMethod.
const PaymentMethodEnum = z.enum(['cash', 'card', 'qr']);

// WHY: Wave 5 — original-sale + new-sale data are an all-or-nothing group.
//      Either NONE are sent (legacy create flow) or ALL must be present.
export const CreateReturnRequestBodySchema = z
  .object({
    storeId: z.string().min(1),
    returnedVariantBarcode: z.string().min(1),
    returnedQuantity: z.number().int().min(1).max(10).default(1),
    // WHY: ISO datetime string; validated against 7-day window in the service.
    saleDate: z.string().datetime(),
    exchangeVariantBarcode: z.string().min(1).optional(),
    reason: z.string().trim().min(3),

    // Wave 5 — original-sale group (optional in schema, coupled in refinement).
    originalSaleId: z.string().min(1).optional(),
    originalSaleItemId: z.string().min(1).optional(),
    originalClosureDate: z.string().datetime().optional(),
    originalPaymentMethod: PaymentMethodEnum.optional(),
    originalSubtotalCents: z.number().int().nonnegative().optional(),

    newPaymentMethod: PaymentMethodEnum.optional(),
    newSubtotalCents: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (val) => {
      const hasAny =
        val.originalSaleId !== undefined ||
        val.originalSaleItemId !== undefined ||
        val.originalClosureDate !== undefined ||
        val.originalPaymentMethod !== undefined ||
        val.originalSubtotalCents !== undefined ||
        val.newPaymentMethod !== undefined ||
        val.newSubtotalCents !== undefined;
      if (!hasAny) return true;
      return (
        val.originalSaleId !== undefined &&
        val.originalSaleItemId !== undefined &&
        val.originalClosureDate !== undefined &&
        val.originalPaymentMethod !== undefined &&
        val.originalSubtotalCents !== undefined &&
        val.newPaymentMethod !== undefined &&
        val.newSubtotalCents !== undefined
      );
    },
    {
      message:
        'Wave 5: si se envía algún campo de original-sale, todos los originales y nuevos son requeridos.',
    },
  );

export type CreateReturnRequestBody = z.infer<typeof CreateReturnRequestBodySchema>;

export const ListMineQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListAllQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  storeId: z.string().min(1).optional(),
  requesterId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const RejectBodySchema = z.object({
  rejectionReason: z.string().trim().min(3),
});

export type RejectBody = z.infer<typeof RejectBodySchema>;

// WHY: Wave 5 — picker UI loads daily closures with their sales for the requester.
export const ClosuresWithSalesQuerySchema = z.object({
  storeId: z.string().min(1),
  // ISO date YYYY-MM-DD; service clamps to last 7 days regardless.
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type ClosuresWithSalesQuery = z.infer<typeof ClosuresWithSalesQuerySchema>;
