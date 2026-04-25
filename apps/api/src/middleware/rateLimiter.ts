import rateLimit, { type Options } from 'express-rate-limit';
import { ERROR_CODES } from '../shared/constants/errorCodes';

export interface RateLimiterOpts {
  windowMs?: number;
  max: number;
  keyGenerator?: Options['keyGenerator'];
}

export function buildRateLimiter(opts: RateLimiterOpts) {
  return rateLimit({
    windowMs: opts.windowMs ?? 60_000,
    limit: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: opts.keyGenerator,
    message: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: 'Too many requests' },
  });
}
