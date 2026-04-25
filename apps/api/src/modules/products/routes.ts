import { Router } from 'express';
import multer from 'multer';
import { authGuard } from '../../middleware/authGuard';
import { roleGuard } from '../../middleware/roleGuard';
import { ADMIN_FLAG } from '../../shared/constants/roles';
import { MAX_IMAGE_BYTES } from './imageStorage';
import type { ProductController } from './controller.product';
import type { VariantController } from './controller.variant';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

export function buildProductsRouter(
  productCtrl: ProductController,
  variantCtrl: VariantController,
): Router {
  const router = Router();

  router.use(authGuard);

  // Products — list and detail are read by any authenticated user
  router.get('/', (req, res, next) => productCtrl.list(req, res, next));
  router.get('/:id', (req, res, next) => productCtrl.getById(req, res, next));

  // Products — admin-only writes
  router.post('/', roleGuard([ADMIN_FLAG]), (req, res, next) =>
    productCtrl.create(req, res, next),
  );
  router.patch('/:id', roleGuard([ADMIN_FLAG]), (req, res, next) =>
    productCtrl.update(req, res, next),
  );
  router.post('/:id/deactivate', roleGuard([ADMIN_FLAG]), (req, res, next) =>
    productCtrl.deactivate(req, res, next),
  );
  router.post('/:id/reactivate', roleGuard([ADMIN_FLAG]), (req, res, next) =>
    productCtrl.reactivate(req, res, next),
  );

  // Variants — admin-only mutations; create accepts multipart with optional image
  router.post(
    '/:productId/variants',
    roleGuard([ADMIN_FLAG]),
    upload.single('image'),
    (req, res, next) => variantCtrl.create(req, res, next),
  );

  return router;
}

export function buildVariantsRouter(variantCtrl: VariantController): Router {
  const router = Router();

  router.use(authGuard);
  router.use(roleGuard([ADMIN_FLAG]));

  router.patch('/:id', upload.single('image'), (req, res, next) =>
    variantCtrl.update(req, res, next),
  );
  router.post('/:id/deactivate', (req, res, next) => variantCtrl.deactivate(req, res, next));
  router.post('/:id/reactivate', (req, res, next) => variantCtrl.reactivate(req, res, next));

  return router;
}
