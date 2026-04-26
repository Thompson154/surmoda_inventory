import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { SaleController } from './controller';

export function buildSalesPerStoreRouter(controller: SaleController): Router {
  const router = Router({ mergeParams: true });
  router.use(authGuard);

  // Order matters: dashboard before /:saleId so the literal route wins.
  router.get('/sales/dashboard', (req, res, next) => controller.dashboard(req, res, next));
  router.get('/sales', (req, res, next) => controller.list(req, res, next));
  router.post('/sales', (req, res, next) => controller.create(req, res, next));
  router.get('/sales/:saleId', (req, res, next) => controller.getById(req, res, next));

  return router;
}
