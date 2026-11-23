// Carga variables de entorno antes de importar módulos dependientes.
import 'dotenv/config';

import { buildServer } from './server';
import { buildComposition } from './composition';
import { loadConfig } from './infrastructure/config';
import { logger } from './infrastructure/logger';
import { disconnectPrisma, getPrisma } from './infrastructure/database';
import { startRefreshTokenCleanup, type CleanupJobHandle } from './jobs/refreshTokenCleanup';
import { startDailyCloseJob, type DailyCloseJobHandle } from './jobs/dailyClose';
import { startDailyLockJob, type DailyLockJobHandle } from './jobs/dailyLock';
import { startAuditRetentionJob, type AuditRetentionJobHandle } from './jobs/auditRetention';
import { startInventorySnapshotCron, type SnapshotCronHandle } from './jobs/inventorySnapshot';

// Registra manejadores para capturar excepciones no controladas.
function installCrashHandlers(): void {
  const crash = (origin: string, err: unknown): void => {
    logger.fatal({ err, origin }, 'fatal: process entering invalid state');
    setTimeout(() => process.exit(1), 5_000).unref();
  };
  process.on('uncaughtException', (err) => crash('uncaughtException', err));
  process.on('unhandledRejection', (reason) => crash('unhandledRejection', reason));
}

async function main(): Promise<void> {
  installCrashHandlers();

  const config = loadConfig();
  const app = buildServer();

  let cleanupJob: CleanupJobHandle | undefined;
  let dailyCloseJob: DailyCloseJobHandle | undefined;
  let dailyLockJob: DailyLockJobHandle | undefined;
  let auditRetentionJob: AuditRetentionJobHandle | undefined;
  let snapshotCronHandle: SnapshotCronHandle | null = null;
  if (config.NODE_ENV !== 'test') {
    // Ensure critical enum values exist in PostgreSQL (safe idempotency guard)
    try {
      await getPrisma().$executeRawUnsafe(
        `ALTER TYPE "delivery_status" ADD VALUE IF NOT EXISTS 'partial_confirmed';`,
      );
    } catch (err) {
      logger.warn({ err }, 'Could not ensure partial_confirmed enum value');
    }

    cleanupJob = startRefreshTokenCleanup(getPrisma());
    const composition = buildComposition();
    dailyCloseJob = startDailyCloseJob({
      reports: composition.dailyReportRepository,
      service: composition.dailyReportService,
    });
    // Inicia el cron de bloqueo de ventas si está habilitado en configuración.
    if (config.ENABLE_DAILY_SALES_LOCK) {
      dailyLockJob = startDailyLockJob({ db: getPrisma() });
      logger.info('Daily sales lock cron started');
    }
    // Inicia el cron de retención de registros de auditoría.
    auditRetentionJob = startAuditRetentionJob(getPrisma(), config.AUDIT_RETENTION_DAYS);
    if (config.AUDIT_RETENTION_DAYS > 0) {
      logger.info({ retentionDays: config.AUDIT_RETENTION_DAYS }, 'Audit retention cron started');
    }

    // Inicia el cron de captura semanal de snapshots de inventario.
    snapshotCronHandle = startInventorySnapshotCron(composition.inventorySnapshotService);
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
    auditRetentionJob?.stop();
    snapshotCronHandle?.stop();

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
  // Captura y registra errores fatales durante el inicio del servidor.
  logger.fatal({ err }, 'API failed to start');
  process.exit(1);
});
