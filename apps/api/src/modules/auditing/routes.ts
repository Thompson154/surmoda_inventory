import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { AuditController } from './controller';

export function buildAuditRouter(controller: AuditController): Router {
  const router = Router();
  router.use(authGuard);
  router.get('/', (req, res, next) => controller.list(req, res, next));
  return router;
}
