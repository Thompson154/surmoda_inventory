import type { Router } from 'express';
import { getPrisma, type Database } from './infrastructure/database';
import {
  buildAuditService,
  buildAuditRepository,
  buildAuditQueryService,
  buildAuditController,
  buildAuditRouter,
  type AuditService,
} from './modules/auditing';
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
import { buildDeliveryRepository } from './modules/deliveries/repository';
import { buildDeliveryService } from './modules/deliveries/service';
import { buildDeliveryController } from './modules/deliveries/controller';
import {
  buildDeliveriesByIdRouter,
  buildDeliveriesPerStoreRouter,
} from './modules/deliveries/routes';
import { buildSaleRepository } from './modules/sales/repository';
import { buildSaleService } from './modules/sales/service';
import { buildSaleController } from './modules/sales/controller';
import { buildSalesPerStoreRouter } from './modules/sales/routes';
import { buildSaleReturnRepository } from './modules/sales/salesReturn.repository';
import { buildSaleReturnService } from './modules/sales/salesReturn.service';
import { buildSaleReturnController } from './modules/sales/salesReturn.controller';
import { buildSaleReturnsRouter } from './modules/sales/salesReturn.routes';
import { buildDailyReportRepository } from './modules/dailyReports/repository';
import { buildDailyReportService } from './modules/dailyReports/service';
import { buildDailyReportController } from './modules/dailyReports/controller';
import { buildDailyReportsPerStoreRouter } from './modules/dailyReports/routes';
import type { DailyReportRepository } from './modules/dailyReports/repository';
import type { DailyReportService } from './modules/dailyReports/service';
import { buildReportRepository } from './modules/reports/repository';
import { buildReportService } from './modules/reports/service';
import { buildReportController } from './modules/reports/controller';
import { buildReportsRouter } from './modules/reports/routes';
import { buildSalesReportRepository } from './modules/reports/salesReport.repository';
import { buildSalesReportService } from './modules/reports/salesReport.service';
import { buildSalesReportController } from './modules/reports/salesReport.controller';
import { buildAlertsRepository } from './modules/alerts/repository';
import { buildAlertsService } from './modules/alerts/service';
import { buildAlertsController } from './modules/alerts/controller';
import { buildAlertsRouter } from './modules/alerts/routes';
import { buildInventorySnapshotRepository } from './modules/inventory-snapshots/repository';
import { buildInventorySnapshotService } from './modules/inventory-snapshots/service';
import { buildInventorySnapshotController } from './modules/inventory-snapshots/controller';
import { buildInventorySnapshotsRouter } from './modules/inventory-snapshots/routes';
import type { InventorySnapshotService } from './modules/inventory-snapshots/service';
import { buildReturnRequestRepository } from './modules/return-requests/repository';
import { buildReturnRequestService } from './modules/return-requests/service';
import { buildReturnRequestController } from './modules/return-requests/controller';
import { buildReturnRequestsRouter } from './modules/return-requests/routes';
import { buildDeliveryEditRequestRepository } from './modules/deliveries/deliveryEditRequest.repository';
import { buildDeliveryEditRequestService } from './modules/deliveries/deliveryEditRequest.service';
import { buildDeliveryEditRequestController } from './modules/deliveries/deliveryEditRequest.controller';
import {
  buildDeliveryEditRequestGlobalRouter,
  buildDeliveryEditRequestPerDeliveryRouter,
} from './modules/deliveries/deliveryEditRequest.routes';

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
  deliveriesPerStoreRouter: Router;
  deliveriesByIdRouter: Router;
  salesPerStoreRouter: Router;
  saleReturnsRouter: Router;
  dailyReportsPerStoreRouter: Router;
  dailyReportRepository: DailyReportRepository;
  dailyReportService: DailyReportService;
  reportsRouter: Router;
  alertsRouter: Router;
  auditRouter: Router;
  inventorySnapshotsRouter: Router;
  inventorySnapshotService: InventorySnapshotService;
  returnRequestsRouter: Router;
  deliveryEditRequestsPerDeliveryRouter: Router;
  deliveryEditRequestsGlobalRouter: Router;
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

  // Single source of truth for store-scoped RBAC: every domain service
  // (sales, deliveries, dailyReports) consumes the same StoreScopeRepo so the
  // permission matrix can never drift between modules. See shared/auth/storeScope.ts.
  const storeScope = {
    async findActiveAssignment(userId: string, storeId: string) {
      const row = await inventoryRepo.findUserAssignment(userId, storeId);
      return row ? { role: row.role } : null;
    },
    async hasAnyEncargadaRole(userId: string) {
      return inventoryRepo.hasAnyEncargadaRole(userId);
    },
  };

  const deliveryRepo = buildDeliveryRepository(db);
  const deliveryService = buildDeliveryService({
    deliveries: deliveryRepo,
    stores: {
      async findById(id) {
        const found = await storesRepo.findById(id);
        if (!found) return null;
        return { id: found.id, kind: found.kind };
      },
    },
    assignments: storeScope,
    products: productsRepo,
    variants: variantsRepo,
    imageStorage,
  });
  const deliveryController = buildDeliveryController(deliveryService);
  const deliveriesPerStoreRouter = buildDeliveriesPerStoreRouter(deliveryController);
  const deliveriesByIdRouter = buildDeliveriesByIdRouter(deliveryController);

  const config = loadConfig();
  const saleRepo = buildSaleRepository(db);
  const saleService = buildSaleService({
    sales: saleRepo,
    assignments: storeScope,
    dailyLockEnabled: config.ENABLE_DAILY_SALES_LOCK,
  });
  const saleController = buildSaleController(saleService);
  const salesPerStoreRouter = buildSalesPerStoreRouter(saleController);

  const saleReturnRepo = buildSaleReturnRepository(db);
  const saleReturnService = buildSaleReturnService({
    saleReturn: saleReturnRepo,
    assignments: storeScope,
  });
  const saleReturnController = buildSaleReturnController(saleReturnService);
  const saleReturnsRouter = buildSaleReturnsRouter(saleReturnController);

  const dailyReportRepository = buildDailyReportRepository(db);
  const dailyReportService = buildDailyReportService({
    reports: dailyReportRepository,
    assignments: {
      async hasAnyEncargadaRole(userId) {
        return inventoryRepo.hasAnyEncargadaRole(userId);
      },
    },
  });
  const dailyReportController = buildDailyReportController(dailyReportService);
  const dailyReportsPerStoreRouter = buildDailyReportsPerStoreRouter(dailyReportController);

  const reportRepo = buildReportRepository(db);
  const reportService = buildReportService({ reports: reportRepo, scope: storeScope });
  const reportController = buildReportController(reportService);

  const salesReportRepo = buildSalesReportRepository(db);
  const salesReportService = buildSalesReportService({
    reports: salesReportRepo,
    scope: storeScope,
  });
  const salesReportController = buildSalesReportController(salesReportService, salesReportRepo);

  const reportsRouter = buildReportsRouter(reportController, salesReportController);

  const alertsRepo = buildAlertsRepository(db);
  const alertsService = buildAlertsService({ alerts: alertsRepo, scope: storeScope });
  const alertsController = buildAlertsController(alertsService);
  const alertsRouter = buildAlertsRouter(alertsController);

  const auditRepo = buildAuditRepository(db);
  const auditQueryService = buildAuditQueryService({ audit: auditRepo, scope: storeScope });
  const auditController = buildAuditController(auditQueryService);
  const auditRouter = buildAuditRouter(auditController);

  const snapshotRepo = buildInventorySnapshotRepository(db);
  const inventorySnapshotService = buildInventorySnapshotService({ snapshots: snapshotRepo });
  const snapshotController = buildInventorySnapshotController(inventorySnapshotService);
  const inventorySnapshotsRouter = buildInventorySnapshotsRouter(snapshotController);

  const returnRequestRepo = buildReturnRequestRepository(db);
  const returnRequestService = buildReturnRequestService({ repo: returnRequestRepo });
  const returnRequestController = buildReturnRequestController({
    service: returnRequestService,
    audit: auditService,
    scope: storeScope,
  });
  const returnRequestsRouter = buildReturnRequestsRouter(returnRequestController);

  const deliveryEditRequestRepo = buildDeliveryEditRequestRepository(db);
  const deliveryEditRequestService = buildDeliveryEditRequestService({
    repo: deliveryEditRequestRepo,
  });
  const deliveryEditRequestController = buildDeliveryEditRequestController({
    service: deliveryEditRequestService,
    audit: auditService,
    scope: storeScope,
  });
  const deliveryEditRequestsPerDeliveryRouter = buildDeliveryEditRequestPerDeliveryRouter(
    deliveryEditRequestController,
  );
  const deliveryEditRequestsGlobalRouter = buildDeliveryEditRequestGlobalRouter(
    deliveryEditRequestController,
  );

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
    deliveriesPerStoreRouter,
    deliveriesByIdRouter,
    salesPerStoreRouter,
    saleReturnsRouter,
    dailyReportsPerStoreRouter,
    dailyReportRepository,
    dailyReportService,
    reportsRouter,
    alertsRouter,
    auditRouter,
    inventorySnapshotsRouter,
    inventorySnapshotService,
    returnRequestsRouter,
    deliveryEditRequestsPerDeliveryRouter,
    deliveryEditRequestsGlobalRouter,
  };
}
