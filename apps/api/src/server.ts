import { resolve } from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadConfig } from './infrastructure/config';
import { errorHandler } from './middleware/errorHandler';
import { attachAuditEmitter } from './middleware/auditLogger';
import { requestIdMiddleware } from './middleware/requestId';
import { requestTimeout } from './middleware/requestTimeout';
import { buildComposition } from './composition';
import { getPrisma } from './infrastructure/database';

export function buildServer(): Express {
  const config = loadConfig();
  const app = express();

  app.disable('x-powered-by');

  // Trust the first proxy in front of the API. Required so:
  //   - express-rate-limit reads X-Forwarded-For instead of treating every
  //     request as 127.0.0.1 (which would defeat per-IP login throttling).
  //   - req.ip and req.protocol reflect the real client behind Render /
  //     Railway / Fly / nginx.
  // We trust only ONE hop; if the deploy ever sits behind multiple proxies
  // (e.g. Cloudflare → Render LB) bump this number to match the chain length.
  app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  // Tier 3.B.9 — bound every request to 30s so a stuck Prisma query doesn't
  // hold a pool slot indefinitely. Skips the health endpoints below since
  // those should never be slow and a 503 from a hung health probe would
  // ironically take the service out of rotation.
  app.use(requestTimeout());

  // Production-grade HTTP hardening. Reasoning per directive:
  //   - contentSecurityPolicy: this API serves only JSON (no HTML), so the
  //     CSP locks every fetch class to 'self' and disables inline + framing
  //     entirely. Cheap defense if someone ever serves an HTML 4xx page.
  //   - hsts: 1-year max-age + subdomains. Disabled in non-prod so local
  //     plain-http development isn't accidentally pinned.
  //   - frameguard: 'deny' — nobody embeds our API in an iframe, ever.
  //   - referrerPolicy: 'no-referrer' so leaked referers don't carry route
  //     names back to third parties.
  //   - crossOriginResourcePolicy stays 'cross-origin' because the FE on a
  //     different origin reads our /static/images path in local-storage mode.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts:
        config.NODE_ENV === 'production'
          ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
          : false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
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
    const imagesDir =
      config.IMAGE_STORAGE_LOCAL_DIR ?? resolve(process.cwd(), '..', '..', 'imagesTest');
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
