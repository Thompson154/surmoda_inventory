import { resolve } from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadConfig } from './infrastructure/config';
import { errorHandler } from './middleware/errorHandler';
import { attachAuditEmitter } from './middleware/auditLogger';
import { requestIdMiddleware } from './middleware/requestId';
import { buildComposition } from './composition';
import { getPrisma } from './infrastructure/database';

export function buildServer(): Express {
  const config = loadConfig();
  const app = express();

  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.FE_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  const composition = buildComposition();
  app.use(attachAuditEmitter(composition.auditService));

  // Liveness — process is up, no I/O.
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Readiness — DB reachable. Used by Kubernetes/Render-style orchestrators
  // before routing traffic. Kept lightweight: a single SELECT 1.
  app.get('/health/ready', async (req: Request, res: Response) => {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch (err) {
      req.log?.error({ err }, 'readiness check failed');
      res.status(503).json({ status: 'not-ready' });
    }
  });

  // Static images: only mounted in `local` storage mode so prod (cloudinary) doesn't expose the disk.
  if (config.IMAGE_STORAGE === 'local') {
    const imagesDir = config.IMAGE_STORAGE_LOCAL_DIR ?? resolve(process.cwd(), '..', '..', 'imagesTest');
    app.use('/static/images', express.static(imagesDir));
  }

  app.use('/api/v1/auth', composition.authRouter);
  app.use('/api/v1/users', composition.usersRouter);
  app.use('/api/v1/users/:userId/assignments', composition.assignmentsRouter);
  app.use('/api/v1/stores', composition.storesRouter);
  app.use('/api/v1/products', composition.productsRouter);
  app.use('/api/v1/variants', composition.variantsRouter);
  app.use('/api/v1/stores/:storeId', composition.inventoryRouter);
  app.use('/api/v1/stores/:storeId', composition.deliveriesPerStoreRouter);
  app.use('/api/v1/deliveries', composition.deliveriesByIdRouter);
  app.use('/api/v1/stores/:storeId', composition.salesPerStoreRouter);
  app.use('/api/v1/stores/:storeId', composition.dailyReportsPerStoreRouter);
  app.use('/api/v1/reports', composition.reportsRouter);
  app.use('/api/v1/alerts', composition.alertsRouter);
  app.use('/api/v1/audit-logs', composition.auditRouter);

  app.use(errorHandler);

  return app;
}
