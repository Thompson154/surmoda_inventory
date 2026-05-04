// Zod schema for POST /api/v1/reports/sales body.

import { z } from 'zod';

export const SalesReportBodySchema = z
  .object({
    storeId: z.string().min(1, 'storeId es requerido'),
    from: z
      .string()
      .datetime({ message: '`from` debe ser un ISO datetime (ej: 2026-01-01T00:00:00.000Z)' }),
    to: z
      .string()
      .datetime({ message: '`to` debe ser un ISO datetime (ej: 2026-01-31T23:59:59.000Z)' }),
    includePaymentSummary: z.boolean().default(false),
    includeInventory: z.boolean().default(false),
    format: z.enum(['preview', 'xlsx']).default('preview'),
  })
  .refine((d) => new Date(d.to) > new Date(d.from), {
    message: '`to` debe ser posterior a `from`',
    path: ['to'],
  });

export type SalesReportBodyInput = z.infer<typeof SalesReportBodySchema>;
