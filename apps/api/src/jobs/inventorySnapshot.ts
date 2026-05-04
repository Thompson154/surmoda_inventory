// Inventory Snapshot cron — captures stock_by_site state every Sunday at 03:00
// Bolivia time (America/La_Paz, UTC-4) for historical reports and bank evidence.
//
// Guard rules:
//   NODE_ENV=test         → never runs (tests mock the service)
//   NODE_ENV!=production  → only runs when ENABLE_SNAPSHOT_CRON=true
//   NODE_ENV=production   → always runs
//
// Schedule: '0 3 * * 0'  → minute 0, hour 3, any day-of-month, any month, Sunday

import cron from 'node-cron';
import { logger } from '../infrastructure/logger';
import type { InventorySnapshotService } from '../modules/inventory-snapshots/service';

const CRON_SCHEDULE = '0 3 * * 0'; // Sunday 03:00 server time

export interface SnapshotCronHandle {
  stop(): void;
}

export function startInventorySnapshotCron(
  service: InventorySnapshotService,
): SnapshotCronHandle | null {
  if (process.env.NODE_ENV === 'test') return null;

  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_SNAPSHOT_CRON !== 'true') {
    logger.info(
      'Snapshot cron NOT registered (set ENABLE_SNAPSHOT_CRON=true to enable outside production)',
    );
    return null;
  }

  const task = cron.schedule(
    CRON_SCHEDULE,
    async () => {
      logger.info({ schedule: CRON_SCHEDULE }, 'Inventory snapshot cron started');
      try {
        const result = await service.captureSnapshot({});
        logger.info(
          { snapshotted: result.snapshotted, capturedAt: result.capturedAt },
          'Inventory snapshot cron completed',
        );
      } catch (err) {
        logger.error({ err }, 'Inventory snapshot cron failed');
      }
    },
    {
      // Bolivia is UTC-4 (no DST). La_Paz is the correct IANA key.
      timezone: process.env.TZ ?? 'America/La_Paz',
    },
  );

  logger.info(
    { schedule: CRON_SCHEDULE, timezone: process.env.TZ ?? 'America/La_Paz' },
    'Inventory snapshot cron registered',
  );
  return {
    stop() {
      // WHY: node-cron v4 task.stop() returns Promise; void elimina warn de floating-promise
      void task.stop();
    },
  };
}
