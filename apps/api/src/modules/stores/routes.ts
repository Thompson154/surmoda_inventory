import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { roleGuard } from '../../middleware/roleGuard';
import { ADMIN_FLAG } from '../../shared/constants/roles';
import type { StoreController } from './controller';

export function buildStoresRouter(controller: StoreController): Router {
  const router = Router();

  router.use(authGuard);

  // Read endpoints: any authenticated user (service applies RBAC scope filter)
  router.get('/', (req, res, next) => controller.list(req, res, next));
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

  // Write endpoints: admin only
  router.post('/', roleGuard([ADMIN_FLAG]), (req, res, next) => controller.create(req, res, next));
  router.patch('/:id', roleGuard([ADMIN_FLAG]), (req, res, next) =>
    controller.update(req, res, next),
  );
  router.post('/:id/deactivate', roleGuard([ADMIN_FLAG]), (req, res, next) =>
    controller.deactivate(req, res, next),
  );
  router.post('/:id/reactivate', roleGuard([ADMIN_FLAG]), (req, res, next) =>
    controller.reactivate(req, res, next),
  );

  return router;
}
