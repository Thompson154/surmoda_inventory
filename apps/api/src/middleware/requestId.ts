import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../infrastructure/logger';

const HEADER = 'x-request-id';

/**
 * Attaches a stable request id to every request and a child logger pre-bound
 * to that id. Downstream handlers that log via `req.log` get correlation for
 * free; clients that supply `X-Request-Id` (typical for retried requests from
 * a SPA) preserve their id end-to-end.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = (incoming && /^[A-Za-z0-9-]{6,128}$/.test(incoming)) ? incoming : randomUUID();
  req.id = id;
  req.log = logger.child({ requestId: id });
  res.setHeader(HEADER, id);
  next();
}
