import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ListDailyReportsQuerySchema = z
  .object({
    from: z.string().regex(ISO_DATE_REGEX).optional(),
    to: z.string().regex(ISO_DATE_REGEX).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(31),
  })
  .strict();

export type ListDailyReportsInput = z.infer<typeof ListDailyReportsQuerySchema>;

export const DailyReportDateParamSchema = z.string().regex(ISO_DATE_REGEX);

export const CloseDayPayloadSchema = z
  .object({
    attendedNames: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  })
  .strict();

export type CloseDayInput = z.infer<typeof CloseDayPayloadSchema>;
