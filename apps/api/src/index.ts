// WHY: load .env BEFORE any module that touches `process.env` at import time.
import 'dotenv/config';

import { buildServer } from './server';
import { buildComposition } from './composition';
import { loadConfig } from './infrastructure/config';
import { logger } from './infrastructure/logger';
import { disconnectPrisma, getPrisma } from './infrastructure/database';
import { startRefreshTokenCleanup, type CleanupJobHandle } from './jobs/refreshTokenCleanup';
import { startDailyCloseJob, type DailyCloseJobHandle } from './jobs/dailyClose';
import { startDailyLockJob, type DailyLockJobHandle } from './jobs/dailyLock';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildServer();

  let cleanupJob: CleanupJobHandle | undefined;
  let dailyCloseJob: DailyCloseJobHandle | undefined;
  let dailyLockJob: DailyLockJobHandle | undefined;
  if (config.NODE_ENV !== 'test') {
    cleanupJob = startRefreshTokenCleanup(getPrisma());
    const composition = buildComposition();
    dailyCloseJob = startDailyCloseJob({
      reports: composition.dailyReportRepository,
      service: composition.dailyReportService,
    });
    // Feature 012 — only spin up the lock cron when explicitly enabled. Schema
    // and code ship dark; flipping the env var lights it up without redeploy.
    if (config.ENABLE_DAILY_SALES_LOCK) {
      dailyLockJob = startDailyLockJob({ db: getPrisma() });
      logger.info('Daily sales lock cron started');
    }
  }

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'API ready');
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    cleanupJob?.stop();
    dailyCloseJob?.stop();
    dailyLockJob?.stop();

    // Stop accepting new connections; resolve once in-flight requests drain.
    await new Promise<void>((res) => server.close(() => res()));
    await disconnectPrisma();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  // Force-exit after a hard ceiling so a misbehaving handler can't block forever.
  const forceExit = (signal: string) => {
    void shutdown(signal);
    setTimeout(() => {
      logger.error('Shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => forceExit('SIGTERM'));
  process.on('SIGINT', () => forceExit('SIGINT'));
}

void main().catch((err) => {
  // Hard failure during startup (bad config, DB unreachable, etc.). Log it
  // structured-style and exit non-zero so a process supervisor (systemd,
  // Docker, Render, etc.) restarts the container cleanly.
  logger.fatal({ err }, 'API failed to start');
  process.exit(1);
});
