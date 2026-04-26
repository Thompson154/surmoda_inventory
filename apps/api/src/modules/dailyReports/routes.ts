import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { DailyReportController } from './controller';

export function buildDailyReportsPerStoreRouter(controller: DailyReportController): Router {
  const router = Router({ mergeParams: true });
  router.use(authGuard);

  router.get('/daily-reports', (req, res, next) => controller.list(req, res, next));
  router.post('/daily-reports/close-today', (req, res, next) =>
    controller.closeToday(req, res, next),
  );
  router.get('/daily-reports/:date', (req, res, next) => controller.getByDate(req, res, next));
  router.get('/daily-reports/:date/items', (req, res, next) =>
    controller.getItemsByDate(req, res, next),
  );

  return router;
}
