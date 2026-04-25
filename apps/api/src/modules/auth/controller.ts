import type { Request, Response, NextFunction } from 'express';
import type { CookieOptions } from 'express';
import { loadConfig, cookieSecure } from '../../infrastructure/config';
import { TokenInvalidError, TokenReplayError } from '../../shared/errors/authErrors';
import { emitAudit } from '../../middleware/auditLogger';
import type { AuthService } from './service';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function refreshCookieOptions(maxAgeMs: number): CookieOptions {
  const config = loadConfig();
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: cookieSecure(),
    domain: config.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeMs,
  };
}

export interface AuthController {
  login(req: Request, res: Response, next: NextFunction): Promise<void>;
  refresh(req: Request, res: Response, next: NextFunction): Promise<void>;
  logout(req: Request, res: Response, next: NextFunction): Promise<void>;
  me(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export function buildAuthController(service: AuthService): AuthController {
  return {
    async login(req, res, next) {
      try {
        const result = await service.login(req.body, {
          ip: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        });
        const ttlMs = result.refreshToken.expiresAt.getTime() - Date.now();
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken.plaintext, refreshCookieOptions(ttlMs));
        emitAudit(req, {
          userId: result.user.id,
          action: 'AUTH_LOGIN_SUCCESS',
          entity: 'User',
          entityId: result.user.id,
          payload: { email: result.user.email },
        });
        res.status(200).json({ accessToken: result.accessToken, user: result.user });
      } catch (err) {
        emitAudit(req, {
          action: 'AUTH_LOGIN_FAILURE',
          entity: 'User',
          payload: { reason: (err as Error).message },
        });
        next(err);
      }
    },

    async refresh(req, res, next) {
      try {
        const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
        if (!cookie) {
          next(new TokenInvalidError());
          return;
        }
        const result = await service.refresh(cookie, {
          ip: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        });
        const ttlMs = result.refreshToken.expiresAt.getTime() - Date.now();
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken.plaintext, refreshCookieOptions(ttlMs));
        res.status(200).json({ accessToken: result.accessToken });
      } catch (err) {
        if (err instanceof TokenReplayError) {
          emitAudit(req, {
            action: 'AUTH_REFRESH_TOKEN_REPLAY',
            entity: 'RefreshToken',
            payload: { reason: 'replay detected — family revoked' },
          });
        }
        next(err);
      }
    },

    async logout(req, res, next) {
      try {
        const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
        if (cookie) {
          await service.logout(cookie);
        }
        res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(0));
        emitAudit(req, {
          userId: req.auth?.userId ?? null,
          action: 'AUTH_LOGOUT',
          entity: 'User',
          payload: {},
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },

    async me(req, res, next) {
      try {
        if (!req.auth) {
          next(new TokenInvalidError());
          return;
        }
        const user = await service.me(req.auth.userId);
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },
  };
}
