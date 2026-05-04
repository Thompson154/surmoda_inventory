import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { InventorySnapshotController } from './controller';

export function buildInventorySnapshotsRouter(controller: InventorySnapshotController): Router {
  const router = Router();

  router.use(authGuard);

  // POST /api/v1/inventory-snapshots — admin-only manual trigger
  router.post('/', (req, res, next) => controller.trigger(req, res, next));

  return router;
}
