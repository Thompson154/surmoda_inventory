import { Router } from 'express';
import { LoginSchema } from './validators';
import { validateBody } from '../../middleware/validateBody';
import { authGuard } from '../../middleware/authGuard';
import { buildRateLimiter } from '../../middleware/rateLimiter';
import { loadConfig } from '../../infrastructure/config';
import type { AuthController } from './controller';

export function buildAuthRouter(controller: AuthController): Router {
  const router = Router();
  const config = loadConfig();

  const loginLimiter = buildRateLimiter({ max: config.RATE_LIMIT_LOGIN_PER_MIN });
  const refreshLimiter = buildRateLimiter({ max: config.RATE_LIMIT_REFRESH_PER_MIN });

  router.post('/login', loginLimiter, validateBody(LoginSchema), (req, res, next) =>
    controller.login(req, res, next),
  );
  router.post('/refresh', refreshLimiter, (req, res, next) => controller.refresh(req, res, next));
  router.post('/logout', (req, res, next) => controller.logout(req, res, next));
  router.get('/me', authGuard, (req, res, next) => controller.me(req, res, next));

  return router;
}
