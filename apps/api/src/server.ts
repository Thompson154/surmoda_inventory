import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadConfig } from './infrastructure/config';
import { getPrisma } from './infrastructure/database';
import { errorHandler } from './middleware/errorHandler';
import { attachAuditEmitter } from './middleware/auditLogger';
import { buildRefreshTokenRepository } from './modules/auth/repository';
import { buildAuthService } from './modules/auth/service';
import { buildAuthController } from './modules/auth/controller';
import { buildAuthRouter } from './modules/auth/routes';
import { buildUserRepository } from './modules/users/repository';
import { buildUserService } from './modules/users/service';
import { buildUserController } from './modules/users/controller';
import { buildUsersRouter } from './modules/users/routes';
import { buildUserStoreRepository } from './modules/assignments/repository';
import { buildAssignmentService } from './modules/assignments/service';
import { buildAssignmentController } from './modules/assignments/controller';
import { buildAssignmentsRouter } from './modules/assignments/routes';

export function buildServer(): Express {
  const config = loadConfig();
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.FE_ORIGIN,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(attachAuditEmitter());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Module wiring (Constitution Principio I — composition root)
  const db = getPrisma();
  const refreshTokens = buildRefreshTokenRepository(db);
  const authService = buildAuthService({ db, refreshTokens });
  const authController = buildAuthController(authService);
  app.use('/api/v1/auth', buildAuthRouter(authController));

  const usersRepo = buildUserRepository(db);
  const usersService = buildUserService({ users: usersRepo, refreshTokens });
  const usersController = buildUserController(usersService);
  app.use('/api/v1/users', buildUsersRouter(usersController));

  const assignmentsRepo = buildUserStoreRepository(db);
  const assignmentsService = buildAssignmentService({ assignments: assignmentsRepo, users: usersRepo });
  const assignmentsController = buildAssignmentController(assignmentsService);
  app.use('/api/v1/users/:userId/assignments', buildAssignmentsRouter(assignmentsController));

  app.use(errorHandler);

  return app;
}
