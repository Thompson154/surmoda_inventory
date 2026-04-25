import { Prisma, PrismaClient } from '@prisma/client';
import { loadConfig } from './config';

// WHY: soft-delete extension auto-filters `findMany` for entities with `deletedAt`
// (Constitution § 4.7). For `findUnique`/`findFirst`/`count`, repositories add the
// `deletedAt: null` filter explicitly — keeps Prisma's unique-key contract intact.
// WHY: RefreshToken has no deletedAt column — soft-delete does not apply to it.
// Only User, UserStore, and Store have the deletedAt field in the schema.
const SOFT_DELETED_MODELS = new Set(['User', 'UserStore', 'Store']);

function buildSoftDeleteExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'soft-delete',
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            if (SOFT_DELETED_MODELS.has(model)) {
              const existing = (args.where ?? {}) as Record<string, unknown>;
              args.where = { deletedAt: null, ...existing } as typeof args.where;
            }
            return query(args);
          },
        },
      },
    }),
  );
}

let prismaSingleton: PrismaClient | undefined;
let extendedSingleton: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!extendedSingleton) {
    const config = loadConfig();
    prismaSingleton = new PrismaClient({
      log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
    extendedSingleton = prismaSingleton.$extends(buildSoftDeleteExtension()) as unknown as PrismaClient;
  }
  return extendedSingleton;
}

export type Database = PrismaClient;

export async function disconnectPrisma(): Promise<void> {
  if (prismaSingleton) {
    await prismaSingleton.$disconnect();
    prismaSingleton = undefined;
    extendedSingleton = undefined;
  }
}

export { Prisma };
