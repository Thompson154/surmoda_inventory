import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { DeliveryEditRequestController } from './deliveryEditRequest.controller';

// WHY: per-delivery sub-routes mounted under /api/v1/deliveries/:deliveryId.
export function buildDeliveryEditRequestPerDeliveryRouter(
  controller: DeliveryEditRequestController,
): Router {
  const router = Router({ mergeParams: true });
  router.use(authGuard);

  router.post('/:deliveryId/edit-requests', (req, res, next) => controller.create(req, res, next));
  router.get('/:deliveryId/edit-requests', (req, res, next) =>
    controller.listByDelivery(req, res, next),
  );

  return router;
}

// WHY: admin-global queue mounted under /api/v1/delivery-edit-requests.
export function buildDeliveryEditRequestGlobalRouter(
  controller: DeliveryEditRequestController,
): Router {
  const router = Router();
  router.use(authGuard);

  router.get('/', (req, res, next) => controller.listAll(req, res, next));
  router.post('/:id/approve', (req, res, next) => controller.approve(req, res, next));
  router.post('/:id/reject', (req, res, next) => controller.reject(req, res, next));

  return router;
}
