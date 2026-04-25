// WHY: load .env BEFORE any module that touches `process.env` at import time.
import 'dotenv/config';

import { buildServer } from './server';
import { loadConfig } from './infrastructure/config';
import { logger } from './infrastructure/logger';
import { disconnectPrisma, getPrisma } from './infrastructure/database';
import { startRefreshTokenCleanup, type CleanupJobHandle } from './jobs/refreshTokenCleanup';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildServer();

  let cleanupJob: CleanupJobHandle | undefined;
  if (config.NODE_ENV !== 'test') {
    cleanupJob = startRefreshTokenCleanup(getPrisma());
  }

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'API ready');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down');
    cleanupJob?.stop();
    server.close(() => undefined);
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main();
