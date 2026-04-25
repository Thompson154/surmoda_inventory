import type { Request, Response, NextFunction } from 'express';
import { emitAudit } from '../../middleware/auditLogger';
import { ListUsersQuerySchema } from './validators';
import type { UserService } from './service';
import type { CreateUserDTO } from './types';

export interface UserController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export function buildUserController(service: UserService): UserController {
  return {
    async create(req, res, next) {
      try {
        const input = req.body as CreateUserDTO;
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
  };
}
