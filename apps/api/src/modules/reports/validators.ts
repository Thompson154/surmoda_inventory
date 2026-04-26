import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ReportSummaryQuerySchema = z
  .object({
    from: z.string().regex(ISO_DATE_REGEX),
    to: z.string().regex(ISO_DATE_REGEX),
  })
  .refine((d) => d.from <= d.to, {
    message: '`from` must be ≤ `to`',
    path: ['from'],
  });

export type ReportSummaryQueryInput = z.infer<typeof ReportSummaryQuerySchema>;
