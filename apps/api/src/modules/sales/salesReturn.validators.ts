import { z } from 'zod';

export const CreateSaleReturnSchema = z
  .object({
    storeId: z.string().min(1).max(64),
    barcode: z.string().min(1).max(128),
    paymentMethod: z.enum(['cash', 'card', 'qr']).optional(),
    reason: z.string().max(200).optional(),
  })
  .strict();

export type CreateSaleReturnInput = z.infer<typeof CreateSaleReturnSchema>;
