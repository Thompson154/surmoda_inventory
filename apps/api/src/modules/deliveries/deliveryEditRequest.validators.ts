import { z } from 'zod';

// WHY: 50-char minimum forces a meaningful explanation, not a one-liner.
export const CreateDeliveryEditRequestBodySchema = z.object({
  reason: z.string().trim().min(50, 'El motivo debe tener al menos 50 caracteres.'),
}).strict();

export type CreateDeliveryEditRequestBody = z.infer<typeof CreateDeliveryEditRequestBodySchema>;

export const RejectDeliveryEditRequestBodySchema = z.object({
  rejectionReason: z.string().trim().min(3),
}).strict();

export type RejectDeliveryEditRequestBody = z.infer<typeof RejectDeliveryEditRequestBodySchema>;

export const ListDeliveryEditRequestsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  storeId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type ListDeliveryEditRequestsQuery = z.infer<typeof ListDeliveryEditRequestsQuerySchema>;
