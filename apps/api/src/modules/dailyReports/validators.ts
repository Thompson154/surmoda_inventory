import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ListDailyReportsQuerySchema = z.object({
  from: z.string().regex(ISO_DATE_REGEX).optional(),
  to: z.string().regex(ISO_DATE_REGEX).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(31),
});

export type ListDailyReportsInput = z.infer<typeof ListDailyReportsQuerySchema>;

export const DailyReportDateParamSchema = z.string().regex(ISO_DATE_REGEX);
