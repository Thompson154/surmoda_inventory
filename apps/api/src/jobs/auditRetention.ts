// Audit log retention. The audit_logs table grows forever otherwise — at
// ~500 rows/day per project this is acceptable for years, but every prod
// deployment should bound it explicitly.
//
// Configuration: AUDIT_RETENTION_DAYS env var. When set to 0 (default in
// development) the cron is disabled — useful for thesis demos where keeping
// the full history matters. In production we recommend 365 days (12 months)
// which strikes a balance between debugging usefulness and table size.
//
// Implementation notes:
//   - Soft-delete is NOT used here. Audit rows are stateless metadata; a
//     row outside the retention window has no further use, and keeping
//     soft-deleted rows would defeat the purpose of the cron.
//   - The deleteMany is bounded by an indexed timestamp filter (idx is on
//     `(action, timestamp)` and `(userId, timestamp)`; either covers).
//   - Errors are swallowed at this level; a missed run is fine, it picks
//     up tomorrow.

import type { Database } from '../infrastructure/database';
import { logger } from '../infrastructure/logger';

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h — daily
// Tier 3.A.5 — batched delete settings. At the year-cliff a single
// `deleteMany` could lock the audit_logs table for minutes on a million-row
// dataset and block every audit write during cierre. Batching by
// `BATCH_SIZE` rows with a `BATCH_PAUSE_MS` yield between batches caps the
// lock window per iteration and lets the audit pipeline keep flowing.
const BATCH_SIZE = 1_000;
const BATCH_PAUSE_MS = 100;
// Hard upper bound on a single tick: prevents an unexpected backlog from
// running this cron for hours. The next tick (24h later) finishes the rest.
const MAX_BATCHES_PER_TICK = 1_000;

export interface AuditRetentionJobHandle {
  stop: () => void;
}

/** Runs once. Exported for unit testing. */
export async function runAuditRetention(db: Database, retentionDays: number): Promise<void> {
  if (retentionDays <= 0) return; // disabled
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let totalDeleted = 0;
  let batches = 0;
  try {
    while (batches < MAX_BATCHES_PER_TICK) {
      // Identify a chunk of expired ids first, then delete by id. Two-step
      // form is cheaper than a top-level `deleteMany ... LIMIT` (which
      // PostgreSQL doesn't support directly in a DELETE statement) and lets
      // us yield between batches without holding any locks.
      const stale = await db.auditLog.findMany({
        where: { timestamp: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
        orderBy: { timestamp: 'asc' },
      });
      if (stale.length === 0) break;
      const result = await db.auditLog.deleteMany({
        where: { id: { in: stale.map((r) => r.id) } },
      });
      totalDeleted += result.count;
      batches += 1;
      if (stale.length < BATCH_SIZE) break;
      // Yield so audit writes (setImmediate fire-and-forget elsewhere) can
      // flush. Skip the pause when no more batches expected.
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
    }
    if (totalDeleted > 0) {
      logger.info(
        { deleted: totalDeleted, batches, cutoff: cutoff.toISOString(), retentionDays },
        'audit retention completed',
      );
    }
  } catch (err) {
    logger.error({ err, totalDeleted, batches }, 'audit retention failed');
  }
}

/**
 * Starts the daily audit retention cron. No-op when retentionDays = 0.
 * Returns a handle whose .stop() must be called on graceful shutdown so
 * the interval doesn't keep the process alive.
 */
export function startAuditRetentionJob(
  db: Database,
  retentionDays: number,
): AuditRetentionJobHandle {
  if (retentionDays <= 0) {
    logger.debug('audit retention disabled (AUDIT_RETENTION_DAYS=0)');
    return { stop: () => undefined };
  }
  void runAuditRetention(db, retentionDays);
  const handle = setInterval(() => void runAuditRetention(db, retentionDays), RUN_INTERVAL_MS);
  return { stop: () => clearInterval(handle) };
}
