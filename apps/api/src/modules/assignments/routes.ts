import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { roleGuard } from '../../middleware/roleGuard';
import { validateBody } from '../../middleware/validateBody';
import { CreateAssignmentSchema, UpdateAssignmentSchema } from './validators';
import { ADMIN_FLAG } from '../../shared/constants/roles';
import type { AssignmentController } from './controller';

export function buildAssignmentsRouter(controller: AssignmentController): Router {
  // mergeParams so :userId from the parent path is available in handlers
  const router = Router({ mergeParams: true });

  router.use(authGuard);
  router.use(roleGuard([ADMIN_FLAG]));

  router.get('/', (req, res, next) => controller.list(req, res, next));
  router.post('/', validateBody(CreateAssignmentSchema), (req, res, next) =>
    controller.create(req, res, next),
  );
  router.patch('/:assignmentId', validateBody(UpdateAssignmentSchema), (req, res, next) =>
    controller.updateRole(req, res, next),
  );
  router.delete('/:assignmentId', (req, res, next) => controller.remove(req, res, next));

  return router;
}
