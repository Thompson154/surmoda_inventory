import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { ReportController } from './controller';
import type { SalesReportController } from './salesReport.controller';

export function buildReportsRouter(
  controller: ReportController,
  salesReportController: SalesReportController,
): Router {
  const router = Router();
  router.use(authGuard);
  router.get('/summary', (req, res, next) => controller.summary(req, res, next));
  router.post('/sales', (req, res, next) => salesReportController.generate(req, res, next));
  return router;
}
