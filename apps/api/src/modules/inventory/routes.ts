import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import type { InventoryController } from './controller';

export function buildInventoryRouter(controller: InventoryController): Router {
  // mergeParams=true so that nested :storeId is available on req.params
  const router = Router({ mergeParams: true });

  router.use(authGuard);

  // Inventory
  router.get('/inventory', (req, res, next) => controller.list(req, res, next));
  router.get('/inventory/grouped', (req, res, next) => controller.listGrouped(req, res, next));
  router.get('/inventory/grouped/:productId', (req, res, next) =>
    controller.listVariantsForProduct(req, res, next),
  );
  router.get('/inventory/by-barcode/:barcode', (req, res, next) =>
    controller.getByBarcode(req, res, next),
  );
  router.patch('/inventory/:variantId', (req, res, next) => controller.adjust(req, res, next));

  // Movements (encargada/admin only — service layer enforces)
  router.get('/movements', (req, res, next) => controller.listMovements(req, res, next));

  // Edit permission
  router.get('/edit-permission', (req, res, next) => controller.getEditPermission(req, res, next));
  router.post('/edit-permission', (req, res, next) => controller.togglePermission(req, res, next));

  return router;
}
