import express, { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { DeliveryController } from './controller';

export function buildDeliveriesPerStoreRouter(controller: DeliveryController): Router {
  const router = Router({ mergeParams: true });
  router.use(authGuard);

  router.get('/deliveries', (req, res, next) => controller.list(req, res, next));
  router.get('/deliveries/grouped', (req, res, next) => controller.listGrouped(req, res, next));
  router.get('/deliveries/intake/lookup', (req, res, next) =>
    controller.intakeLookup(req, res, next),
  );
  router.post('/deliveries', (req, res, next) => controller.create(req, res, next));
  // Intake carries up to ~5 base64-encoded images per submission. Local body
  // parser (1mb global) is too small — apply a per-route 12mb limit.
  router.post(
    '/deliveries/intake',
    express.json({ limit: '12mb' }),
    (req, res, next) => controller.intake(req, res, next),
  );

  return router;
}

export function buildDeliveriesByIdRouter(controller: DeliveryController): Router {
  const router = Router();
  router.use(authGuard);
  router.get('/:deliveryId', (req, res, next) => controller.getById(req, res, next));
  router.patch('/:deliveryId/draft', (req, res, next) => controller.updateDraft(req, res, next));
  router.post('/:deliveryId/confirm', (req, res, next) => controller.confirmDraft(req, res, next));
  router.post('/:deliveryId/receive', (req, res, next) => controller.receive(req, res, next));
  return router;
}
