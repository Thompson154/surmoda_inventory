// Feature 012 — Daily sales lock for branch stores.
//
//   22:00 Bolivia (UTC-4 → 02:00 UTC)  → set Store.salesLockedAt = now()
//   00:00 Bolivia (UTC-4 → 04:00 UTC)  → clear Store.salesLockedAt
//
// The job runs every minute (cheap) and only acts when the configured wall-clock
// crosses one of the two thresholds. It's gated by ENABLE_DAILY_SALES_LOCK so the
// schema and code can ship to production before the behaviour is enabled.
//
// FUTURE wiring (do this when we flip the switch):
//   1. Set ENABLE_DAILY_SALES_LOCK=true in the prod env file.
//   2. Confirm the API process clock is in UTC (containers usually are).
//   3. The CashierModal already reads SALES_LOCKED → render greyed-out and
//      tooltip "Cerrá el día primero" (left as TODO in the FE).
//   4. Optional follow-up: skip the auto-lock when DailyReport for that day
//      already exists, so encargada cierre antes de las 22:00 desbloquea.

import { logger } from '../infrastructure/logger';
import type { Database } from '../infrastructure/database';

const MINUTE_MS = 60 * 1000;
const BOLIVIA_OFFSET_MS = 4 * 60 * 60 * 1000;

export interface DailyLockJobHandle {
  stop(): void;
  /** Exposed for tests — runs the tick logic once. */
  runOnce(now?: Date): Promise<void>;
}

export interface DailyLockJobDeps {
  db: Database;
  /** Hour of day (0..23) in Bolivia local that triggers the lock. */
  lockHour?: number;
  /** Hour of day (0..23) in Bolivia local that releases the lock. Usually 0. */
  releaseHour?: number;
}

export function startDailyLockJob(deps: DailyLockJobDeps): DailyLockJobHandle {
  const lockHour = deps.lockHour ?? 22;
  const releaseHour = deps.releaseHour ?? 0;
  let timer: NodeJS.Timeout | null = null;

  function boliviaHour(now: Date): number {
    const local = new Date(now.getTime() - BOLIVIA_OFFSET_MS);
    return local.getUTCHours();
  }

  async function runOnce(now: Date = new Date()): Promise<void> {
    const hour = boliviaHour(now);
    try {
      if (hour === lockHour) {
        // Lock branches that aren't already locked. Warehouses never get locked
        // because there's no sales endpoint there.
        const { count } = await deps.db.store.updateMany({
          where: {
            kind: 'branch',
            isActive: true,
            deletedAt: null,
            salesLockedAt: null,
          },
          data: { salesLockedAt: now },
        });
        if (count > 0) logger.info({ count, lockHour }, 'daily sales lock applied');
      } else if (hour === releaseHour) {
        const { count } = await deps.db.store.updateMany({
          where: { salesLockedAt: { not: null } },
          data: { salesLockedAt: null },
        });
        if (count > 0) logger.info({ count, releaseHour }, 'daily sales lock released');
      }
    } catch (err) {
      logger.error({ err }, 'daily lock tick crashed');
    }
  }

  function tick(): void {
    void runOnce();
  }

  tick();
  timer = setInterval(tick, MINUTE_MS);
  if (timer.unref) timer.unref();

  return {
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    runOnce,
  };
}
