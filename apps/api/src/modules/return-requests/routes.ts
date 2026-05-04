import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { ReturnRequestController } from './controller';

export function buildReturnRequestsRouter(controller: ReturnRequestController): Router {
  const router = Router();

  router.use(authGuard);

  // POST /api/v1/return-requests — submit a return request
  router.post('/', (req, res, next) => controller.submit(req, res, next));

  // WHY: Wave 5 — picker UI loads daily closures + sales for the requester.
  router.get('/closures-with-sales', (req, res, next) =>
    controller.closuresWithSales(req, res, next),
  );

  // GET /api/v1/return-requests/mine — list own requests (vendedora/encargada only)
  router.get('/mine', (req, res, next) => controller.listMine(req, res, next));

  // GET /api/v1/return-requests — full queue (admin only)
  router.get('/', (req, res, next) => controller.listAll(req, res, next));

  // GET /api/v1/return-requests/:id — single request (admin or requester)
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

  // POST /api/v1/return-requests/:id/approve — admin only
  router.post('/:id/approve', (req, res, next) => controller.approve(req, res, next));

  // POST /api/v1/return-requests/:id/reject — admin only
  router.post('/:id/reject', (req, res, next) => controller.reject(req, res, next));

  return router;
}
