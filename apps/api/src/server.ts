import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadConfig } from './infrastructure/config';
import { errorHandler } from './middleware/errorHandler';
import { attachAuditEmitter } from './middleware/auditLogger';
import { buildComposition } from './composition';

export function buildServer(): Express {
  const config = loadConfig();
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.FE_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  const composition = buildComposition();
  app.use(attachAuditEmitter(composition.auditService));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/v1/auth', composition.authRouter);
  app.use('/api/v1/users', composition.usersRouter);
  app.use('/api/v1/users/:userId/assignments', composition.assignmentsRouter);
  app.use('/api/v1/stores', composition.storesRouter);

  app.use(errorHandler);

  return app;
}
