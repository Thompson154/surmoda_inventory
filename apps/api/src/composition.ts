import type { Router } from 'express';
import { getPrisma, type Database } from './infrastructure/database';
import { buildAuditService, type AuditService } from './modules/auditing';
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
import { buildStoreRepository } from './modules/stores/repository';
import { buildStoreService } from './modules/stores/service';
import { buildStoreController } from './modules/stores/controller';
import { buildStoresRouter } from './modules/stores/routes';
import { buildProductRepository } from './modules/products/repository.product';
import { buildVariantRepository } from './modules/products/repository.variant';
import { buildProductService } from './modules/products/service.product';
import { buildVariantService } from './modules/products/service.variant';
import { buildProductController } from './modules/products/controller.product';
import { buildVariantController } from './modules/products/controller.variant';
import { buildProductsRouter, buildVariantsRouter } from './modules/products/routes';
import { buildImageStorage } from './modules/products/imageStorage';
import { loadConfig } from './infrastructure/config';
import { buildInventoryRepository } from './modules/inventory/repository';
import { buildInventoryService } from './modules/inventory/service';
import { buildInventoryController } from './modules/inventory/controller';
import { buildInventoryRouter } from './modules/inventory/routes';

export interface Composition {
  db: Database;
  auditService: AuditService;
  authRouter: Router;
  usersRouter: Router;
  assignmentsRouter: Router;
  storesRouter: Router;
  productsRouter: Router;
  variantsRouter: Router;
  inventoryRouter: Router;
}

/**
 * Build the application composition root.
 * Wires all repositories → services → controllers → routers.
 * Single place where dependency injection happens.
 */
export function buildComposition(): Composition {
  const db = getPrisma();

  const auditService = buildAuditService(db);

  const refreshTokens = buildRefreshTokenRepository(db);
  const authService = buildAuthService({ db, refreshTokens });
  const authController = buildAuthController(authService);
  const authRouter = buildAuthRouter(authController);

  const usersRepo = buildUserRepository(db);
  const usersService = buildUserService({ users: usersRepo, refreshTokens });
  const usersController = buildUserController(usersService);
  const usersRouter = buildUsersRouter(usersController);

  const assignmentsRepo = buildUserStoreRepository(db);
  const storesRepo = buildStoreRepository(db);

  const assignmentsService = buildAssignmentService({
    assignments: assignmentsRepo,
    users: usersRepo,
    stores: storesRepo,
  });
  const assignmentsController = buildAssignmentController(assignmentsService);
  const assignmentsRouter = buildAssignmentsRouter(assignmentsController);

  const storesService = buildStoreService({
    stores: storesRepo,
    assignments: assignmentsRepo,
  });
  const storesController = buildStoreController(storesService);
  const storesRouter = buildStoresRouter(storesController);

  const productsRepo = buildProductRepository(db);
  const variantsRepo = buildVariantRepository(db);
  const imageStorage = buildImageStorage(loadConfig());

  const productsService = buildProductService({ products: productsRepo, variants: variantsRepo });
  const variantsService = buildVariantService({
    products: productsRepo,
    variants: variantsRepo,
    imageStorage,
  });

  const productsController = buildProductController(productsService);
  const variantsController = buildVariantController(variantsService);
  const productsRouter = buildProductsRouter(productsController, variantsController);
  const variantsRouter = buildVariantsRouter(variantsController);

  const inventoryRepo = buildInventoryRepository(db);
  const inventoryService = buildInventoryService({ inventory: inventoryRepo });
  const inventoryController = buildInventoryController(inventoryService);
  const inventoryRouter = buildInventoryRouter(inventoryController);

  return {
    db,
    auditService,
    authRouter,
    usersRouter,
    assignmentsRouter,
    storesRouter,
    productsRouter,
    variantsRouter,
    inventoryRouter,
  };
}
