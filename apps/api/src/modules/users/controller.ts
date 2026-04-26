import type { Request, Response, NextFunction } from 'express';
import { emitAudit } from '../../middleware/auditLogger';
import {
  CreateUserSchema,
  ListUsersQuerySchema,
  ResetPasswordSchema,
  UpdateUserSchema,
} from './validators';
import type { UserService } from './service';

export interface UserController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
  update(req: Request, res: Response, next: NextFunction): Promise<void>;
  deactivate(req: Request, res: Response, next: NextFunction): Promise<void>;
  reactivate(req: Request, res: Response, next: NextFunction): Promise<void>;
  resetPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export function buildUserController(service: UserService): UserController {
  return {
    async create(req, res, next) {
      try {
        const input = CreateUserSchema.parse(req.body);
        const user = await service.create(input);
        emitAudit(req, {
          userId: req.auth?.userId ?? null,
          action: 'USER_CREATED',
          entity: 'User',
          entityId: user.id,
          payload: { email: user.email, isAdmin: user.isAdmin, assignmentsCount: user.assignments.length },
        });
        res.status(201).json(user);
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const query = ListUsersQuerySchema.parse(req.query);
        const result = await service.list(query);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'id required' });
          return;
        }
        const user = await service.getById(id);
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'id required' });
          return;
        }
        const input = UpdateUserSchema.parse(req.body);
        const user = await service.update(id, input);
        emitAudit(req, {
          userId: req.auth?.userId ?? null,
          action: 'USER_UPDATED',
          entity: 'User',
          entityId: user.id,
          payload: { fullName: user.fullName, isAdmin: user.isAdmin },
        });
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    async deactivate(req, res, next) {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'id required' });
          return;
        }
        const user = await service.deactivate(id);
        emitAudit(req, {
          userId: req.auth?.userId ?? null,
          action: 'USER_DEACTIVATED',
          entity: 'User',
          entityId: user.id,
          payload: {},
        });
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    async reactivate(req, res, next) {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'id required' });
          return;
        }
        const user = await service.reactivate(id);
        emitAudit(req, {
          userId: req.auth?.userId ?? null,
          action: 'USER_REACTIVATED',
          entity: 'User',
          entityId: user.id,
          payload: {},
        });
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    async resetPassword(req, res, next) {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'id required' });
          return;
        }
        const input = ResetPasswordSchema.parse(req.body);
        await service.adminResetPassword(id, input);
        // WHY: NEVER include the plaintext in the audit payload.
        emitAudit(req, {
          userId: req.auth?.userId ?? null,
          action: 'USER_PASSWORD_RESET_BY_ADMIN',
          entity: 'User',
          entityId: id,
          payload: { resetByAdminId: req.auth?.userId ?? null },
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  };
}
