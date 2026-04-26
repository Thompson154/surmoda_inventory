// WHY: ensures every active store gets a DailyReport for the previous Bolivia-local
// day even if the encargada forgets the manual cierre. Runs once an hour and is
// idempotent — re-creating the report just refreshes the snapshot from the same
// (append-only) sales data.

import { Prisma } from '@prisma/client';
import { logger } from '../infrastructure/logger';
import type { DailyReportRepository } from '../modules/dailyReports/repository';
import type { DailyReportService } from '../modules/dailyReports/service';
import { boliviaDayKey, isoDateBolivia, previousBoliviaDayKey } from '../shared/datetime/bolivia';

const HOUR_MS = 60 * 60 * 1000;

export interface DailyCloseJobDeps {
  reports: DailyReportRepository;
  service: DailyReportService;
}

export interface DailyCloseJobHandle {
  stop(): void;
  /** Exposed for tests — runs the close logic once. */
  runOnce(now?: Date): Promise<void>;
}

export function startDailyCloseJob(deps: DailyCloseJobDeps): DailyCloseJobHandle {
  let timer: NodeJS.Timeout | null = null;

  async function runOnce(now: Date = new Date()): Promise<void> {
    const yesterday = previousBoliviaDayKey(now);
    const stores = await deps.reports.listActiveStores();
    for (const s of stores) {
      try {
        // Skip stores that have never sold anything — nothing to close.
        const firstSale = await deps.reports.findFirstSaleDay(s.id);
        if (!firstSale) continue;
        // Skip stores whose first sale is later than yesterday.
        if (boliviaDayKey(firstSale).getTime() > yesterday.getTime()) continue;
        const existing = await deps.reports.findByDate(s.id, yesterday);
        if (existing) continue;
        await deps.service.closeForDay(s.id, yesterday, null, true, []);
        logger.info(
          { storeId: s.id, date: isoDateBolivia(yesterday) },
          'auto-closed daily report',
        );
      } catch (err) {
        // P2002 = unique violation on (store_id, date). Means another instance
        // (multi-replica deploy, manual close racing the cron) already closed
        // this day. Treat as success — the snapshot exists.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          logger.info({ storeId: s.id }, 'daily report already closed by concurrent writer');
          continue;
        }
        logger.error({ err, storeId: s.id }, 'auto-close daily report failed');
      }
    }
  }

  function tick(): void {
    // Inner runOnce already swallows per-store errors; only an unexpected
    // failure (e.g. listActiveStores throws) reaches here.
    void runOnce().catch((err) => logger.error({ err }, 'daily close cron crashed'));
  }

  // First tick on boot, then once an hour.
  tick();
  timer = setInterval(tick, HOUR_MS);
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
