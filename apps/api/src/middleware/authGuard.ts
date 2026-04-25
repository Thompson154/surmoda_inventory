import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../infrastructure/jwt';
import { TokenExpiredError, TokenInvalidError } from '../shared/errors/authErrors';

export function authGuard(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new TokenInvalidError());
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, isAdmin: payload.isAdmin };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new TokenExpiredError());
      return;
    }
    next(new TokenInvalidError());
  }
}
