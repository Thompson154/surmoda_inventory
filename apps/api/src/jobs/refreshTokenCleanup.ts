import type { Database } from '../infrastructure/database';
import { logger } from '../infrastructure/logger';

const RETENTION_DAYS = 30;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

export interface CleanupJobHandle {
  stop: () => void;
}

/**
 * Deletes refresh tokens whose expiresAt is older than RETENTION_DAYS.
 * Exported for unit-testing — takes db directly as argument.
 */
export async function runRefreshTokenCleanup(db: Database): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const result = await db.refreshToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      logger.info({ deleted: result.count, cutoff }, 'refresh token cleanup completed');
    }
  } catch (err) {
    logger.error({ err }, 'refresh token cleanup failed');
  }
}

/**
 * Runs runRefreshTokenCleanup once on start and then every 24h.
 * Idempotent and safe to skip on error.
 */
export function startRefreshTokenCleanup(db: Database): CleanupJobHandle {
  void runRefreshTokenCleanup(db);
  const handle = setInterval(() => void runRefreshTokenCleanup(db), RUN_INTERVAL_MS);

  return {
    stop: () => clearInterval(handle),
  };
}
