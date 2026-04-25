import type { Request, Response, NextFunction } from 'express';
import { emitAudit } from '../../middleware/auditLogger';
import { RemoveAssignmentQuerySchema } from './validators';
import type { AssignmentService } from './service';
import type { CreateAssignmentDTO, UpdateAssignmentDTO } from './types';

export interface AssignmentController {
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateRole(req: Request, res: Response, next: NextFunction): Promise<void>;
  remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function getUserId(req: Request): string | null {
  return req.params.userId ?? null;
}

export function buildAssignmentController(service: AssignmentService): AssignmentController {
  return {
    async list(req, res, next) {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'userId required' });
          return;
        }
        const items = await service.list(userId);
        res.status(200).json({ items });
      } catch (err) {
        next(err);
      }
    },

    async create(req, res, next) {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'userId required' });
          return;
        }
        const input = req.body as CreateAssignmentDTO;
        const created = await service.create(userId, input);
        emitAudit(req, {
          userId: req.auth?.userId ?? null,
          action: 'ASSIGNMENT_CREATED',
          entity: 'UserStore',
          entityId: created.id,
          payload: { targetUserId: userId, storeId: created.storeId, role: created.role },
        });
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },

    async updateRole(req, res, next) {
      try {
        const userId = getUserId(req);
        const assignmentId = req.params.assignmentId;
        if (!userId || !assignmentId) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'userId and assignmentId required' });
          return;
        }
        const input = req.body as UpdateAssignmentDTO;
        const updated = await service.updateRole(userId, assignmentId, input);
        emitAudit(req, {
          userId: req.auth?.userId ?? null,
          action: 'ASSIGNMENT_ROLE_CHANGED',
          entity: 'UserStore',
          entityId: updated.id,
          payload: { targetUserId: userId, storeId: updated.storeId, role: updated.role },
        });
        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        const userId = getUserId(req);
        const assignmentId = req.params.assignmentId;
        if (!userId || !assignmentId) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'userId and assignmentId required' });
          return;
        }
        const query = RemoveAssignmentQuerySchema.parse(req.query);
        await service.remove(userId, assignmentId, { confirm: query.confirm });
        emitAudit(req, {
          userId: req.auth?.userId ?? null,
          action: 'ASSIGNMENT_REMOVED',
          entity: 'UserStore',
          entityId: assignmentId,
          payload: { targetUserId: userId },
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  };
}
