import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { ForbiddenRoleError, ForbiddenStoreError, TokenInvalidError } from '../shared/errors/authErrors';
import { getPrisma } from '../infrastructure/database';
import { ADMIN_FLAG } from '../shared/constants/roles';

type AllowedRole = Role | typeof ADMIN_FLAG;

export interface RoleGuardOptions {
  /** When set, the middleware resolves the target store from `req.params[<key>]`. */
  resolveStoreFrom?: 'params' | 'body';
  storeKey?: string;
}

const DEFAULT_OPTIONS: Required<RoleGuardOptions> = {
  resolveStoreFrom: 'params',
  storeKey: 'storeId',
};

export function roleGuard(allowed: AllowedRole[], options: RoleGuardOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      next(new TokenInvalidError());
      return;
    }

    if (req.auth.isAdmin) {
      if (allowed.includes(ADMIN_FLAG)) {
        next();
        return;
      }
      // Admin not explicitly allowed for this route — admins can still pass any non-admin-only route
      next();
      return;
    }

    if (allowed.length === 1 && allowed[0] === ADMIN_FLAG) {
      next(new ForbiddenRoleError());
      return;
    }

    const storeId = readStoreId(req, opts);
    if (!storeId) {
      next(new ForbiddenStoreError());
      return;
    }

    try {
      const prisma = getPrisma();
      const assignment = await prisma.userStore.findFirst({
        where: { userId: req.auth.userId, storeId },
        select: { role: true },
      });
      if (!assignment) {
        next(new ForbiddenStoreError());
        return;
      }
      if (!allowed.includes(assignment.role)) {
        next(new ForbiddenRoleError());
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function readStoreId(req: Request, opts: Required<RoleGuardOptions>): string | null {
  const source = opts.resolveStoreFrom === 'params' ? req.params : (req.body as Record<string, unknown>);
  const value = (source ?? {})[opts.storeKey];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
