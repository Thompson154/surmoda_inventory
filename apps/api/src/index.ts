// WHY: load .env BEFORE any module that touches `process.env` at import time.
import 'dotenv/config';

import { buildServer } from './server';
import { buildComposition } from './composition';
import { loadConfig } from './infrastructure/config';
import { logger } from './infrastructure/logger';
import { disconnectPrisma, getPrisma } from './infrastructure/database';
import { startRefreshTokenCleanup, type CleanupJobHandle } from './jobs/refreshTokenCleanup';
import { startDailyCloseJob, type DailyCloseJobHandle } from './jobs/dailyClose';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildServer();

  let cleanupJob: CleanupJobHandle | undefined;
  let dailyCloseJob: DailyCloseJobHandle | undefined;
  if (config.NODE_ENV !== 'test') {
    cleanupJob = startRefreshTokenCleanup(getPrisma());
    const composition = buildComposition();
    dailyCloseJob = startDailyCloseJob({
      reports: composition.dailyReportRepository,
      service: composition.dailyReportService,
    });
  }

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'API ready');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down');
    cleanupJob?.stop();
    dailyCloseJob?.stop();
    server.close(() => undefined);
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main().catch((err) => {
  // Hard failure during startup (bad config, DB unreachable, etc.). Log it
  // structured-style and exit non-zero so a process supervisor (systemd,
  // Docker, Render, etc.) restarts the container cleanly.
  logger.fatal({ err }, 'API failed to start');
  process.exit(1);
});
