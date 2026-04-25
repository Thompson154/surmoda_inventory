import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { roleGuard } from '../../middleware/roleGuard';
import { validateBody } from '../../middleware/validateBody';
import { CreateUserSchema } from './validators';
import { ADMIN_FLAG } from '../../shared/constants/roles';
import type { UserController } from './controller';

export function buildUsersRouter(controller: UserController): Router {
  const router = Router();

  router.use(authGuard);
  router.use(roleGuard([ADMIN_FLAG]));

  router.get('/', (req, res, next) => controller.list(req, res, next));
  router.post('/', validateBody(CreateUserSchema), (req, res, next) =>
    controller.create(req, res, next),
  );
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

  return router;
}
