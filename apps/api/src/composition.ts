import type { Router } from 'express';
import { getPrisma, type Database } from './infrastructure/database';
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

export interface Composition {
  db: Database;
  authRouter: Router;
  usersRouter: Router;
  assignmentsRouter: Router;
}

/**
 * Build the application composition root.
 * Wires all repositories → services → controllers → routers.
 * Single place where dependency injection happens.
 */
export function buildComposition(): Composition {
  const db = getPrisma();

  const refreshTokens = buildRefreshTokenRepository(db);
  const authService = buildAuthService({ db, refreshTokens });
  const authController = buildAuthController(authService);
  const authRouter = buildAuthRouter(authController);

  const usersRepo = buildUserRepository(db);
  const usersService = buildUserService({ users: usersRepo, refreshTokens });
  const usersController = buildUserController(usersService);
  const usersRouter = buildUsersRouter(usersController);

  const assignmentsRepo = buildUserStoreRepository(db);
  const assignmentsService = buildAssignmentService({ assignments: assignmentsRepo, users: usersRepo });
  const assignmentsController = buildAssignmentController(assignmentsService);
  const assignmentsRouter = buildAssignmentsRouter(assignmentsController);

  return { db, authRouter, usersRouter, assignmentsRouter };
}
