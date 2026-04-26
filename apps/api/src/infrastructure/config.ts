import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),

  COOKIE_DOMAIN: z.string().default('localhost'),
  FE_ORIGIN: z.string().url().default('http://localhost:5173'),

  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  RATE_LIMIT_LOGIN_PER_MIN: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_REFRESH_PER_MIN: z.coerce.number().int().positive().default(30),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Feature 012 — when true the dailyLock cron locks branch sales at 22:00
   *  Bolivia and clears the lock at 00:00. Default false so the behaviour is
   *  dark-launched until product is ready to flip it. */
  ENABLE_DAILY_SALES_LOCK: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),

  /** Tier 1 — number of days to keep audit_logs rows. 0 disables the cron
   *  (useful for dev / thesis demo). Recommended in production: 365. */
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(0).max(3650).default(0),

  IMAGE_STORAGE: z.enum(['local', 'cloudinary']).default('local'),
  IMAGE_STORAGE_LOCAL_DIR: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.IMAGE_STORAGE === 'cloudinary') {
    const missing = (
      ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const
    ).filter((k) => !data[k]);
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['IMAGE_STORAGE'],
        message: `IMAGE_STORAGE=cloudinary requires: ${missing.join(', ')}`,
      });
    }
  }
  // Tier 1 — bcrypt rounds in production must meet OWASP ASVS 4.0 V2.4.1
  // (≥10 rounds; we lift the floor to 12 to align with the user-creation
  // policy). Lower rounds remain allowed in dev/test for fast hashing
  // during the test suite.
  if (data.NODE_ENV === 'production' && data.BCRYPT_SALT_ROUNDS < 12) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BCRYPT_SALT_ROUNDS'],
      message:
        'BCRYPT_SALT_ROUNDS must be ≥12 in production (OWASP ASVS 4.0 V2.4.1).',
    });
  }
});

export type AppConfig = z.infer<typeof EnvSchema>;

let cached: AppConfig | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetConfigForTests(): void {
  cached = undefined;
}

export function isProd(): boolean {
  return loadConfig().NODE_ENV === 'production';
}

export function isTest(): boolean {
  return loadConfig().NODE_ENV === 'test';
}

export function cookieSecure(): boolean {
  return isProd();
}
