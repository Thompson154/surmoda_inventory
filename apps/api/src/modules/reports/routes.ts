import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { ReportController } from './controller';

export function buildReportsRouter(controller: ReportController): Router {
  const router = Router();
  router.use(authGuard);
  router.get('/summary', (req, res, next) => controller.summary(req, res, next));
  return router;
}
