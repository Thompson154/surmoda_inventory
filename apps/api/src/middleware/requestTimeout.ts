// Tier 3.B.9 — request-level timeout.
//
// Without this, a slow Prisma query (or an unresponsive Cloudinary upload)
// can hold an Express handler open indefinitely. The Render Hobby pool has
// 50 connections; a few stuck requests + Prisma's default pool of 5 per
// instance = real chance of pool starvation under load.
//
// Strategy: register a per-request timeout via `req.setTimeout`. When it
// fires, we send a 503 if headers haven't been sent yet and tell Express
// to abort the underlying socket. Downstream Prisma queries don't see the
// abort directly (Prisma cancellation is opt-in via AbortSignal which
// requires plumbing through every repo) — but the pool slot frees once
// Node tears down the connection.
//
// We deliberately keep the value generous (30s) so legitimate slow paths
// (intake with image upload, dashboard with 28-day window) don't trip it.
// Anything slower than 30s is almost certainly stuck and should fail loud.

import type { NextFunction, Request, Response } from 'express';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface RequestTimeoutOptions {
  /** Override the default 30s ceiling. */
  timeoutMs?: number;
}

export function requestTimeout(options: RequestTimeoutOptions = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return function requestTimeoutMiddleware(req: Request, res: Response, next: NextFunction) {
    req.setTimeout(timeoutMs, () => {
      // Don't try to send if the response is already partway out.
      if (res.headersSent) {
        // Best-effort destroy of the socket so the pool slot frees.
        req.socket?.destroy();
        return;
      }
      // Log via the request-bound child logger if available.
      req.log?.warn(
        { method: req.method, path: req.path, timeoutMs },
        'request timed out — aborting',
      );
      try {
        res.status(503).json({
          code: 'REQUEST_TIMEOUT',
          message: 'La solicitud demoró demasiado. Volvé a intentar.',
        });
      } catch {
        // res.json itself might throw if the connection is half-closed.
      }
    });
    next();
  };
}
