import { z } from 'zod';
import { Role } from '@prisma/client';

const RoleEnum = z.nativeEnum(Role);

export const CreateAssignmentSchema = z
  .object({
    storeId: z.string().min(1, 'storeId is required'),
    role: RoleEnum,
  })
  .strict();

export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;

export const UpdateAssignmentSchema = z
  .object({
    role: RoleEnum,
  })
  .strict();

export type UpdateAssignmentInput = z.infer<typeof UpdateAssignmentSchema>;

export const RemoveAssignmentQuerySchema = z
  .object({
    confirm: z
      .union([z.boolean(), z.string()])
      .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
      .optional(),
  })
  .strict();

export type RemoveAssignmentQuery = z.infer<typeof RemoveAssignmentQuerySchema>;
