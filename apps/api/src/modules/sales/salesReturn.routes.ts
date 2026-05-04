import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { SaleReturnController } from './salesReturn.controller';

export function buildSaleReturnsRouter(controller: SaleReturnController): Router {
  const router = Router();
  router.use(authGuard);

  router.post('/sales/returns', (req, res, next) => controller.create(req, res, next));

  return router;
}
