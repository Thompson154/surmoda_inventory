import { z } from 'zod';
import { Role } from '@prisma/client';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_RULES_MESSAGE,
} from '../../shared/constants/tokenConfig';

const RoleEnum = z.nativeEnum(Role);

const StrongPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_RULES_MESSAGE)
  .regex(PASSWORD_PATTERN, PASSWORD_RULES_MESSAGE);

const AssignmentInputSchema = z.object({
  storeId: z.string().min(1, 'storeId is required'),
  role: RoleEnum,
});

export const CreateUserSchema = z
  .object({
    email: z.string().email().transform((v) => v.toLowerCase()),
    password: StrongPassword,
    fullName: z.string().trim().min(1).max(120),
    isAdmin: z.boolean().optional().default(false),
    assignments: z.array(AssignmentInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isAdmin) {
      if (!data.assignments || data.assignments.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['assignments'],
          message: 'Non-admin users require at least one store assignment',
        });
      }
    } else if (data.assignments && data.assignments.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assignments'],
        message: 'Admin users must NOT have store assignments',
      });
    }
  });

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const ListUsersQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  isAdmin: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListUsersInput = z.infer<typeof ListUsersQuerySchema>;

export const UpdateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  isAdmin: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  newPassword: StrongPassword,
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
