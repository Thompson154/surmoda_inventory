import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { AlertsController } from './controller';

export function buildAlertsRouter(controller: AlertsController): Router {
  const router = Router();
  router.use(authGuard);
  router.get('/', (req, res, next) => controller.list(req, res, next));
  return router;
}
