import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;
