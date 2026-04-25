import type { Request, Response } from 'express';
import { logger } from '../infrastructure/logger';

export interface AuditEvent {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

// WHY: write is fire-and-forget via setImmediate AFTER the response is sent.
// Constitution PARTE VI § 6.2 — audit MUST NOT add measurable latency.
export function emitAudit(req: Request, event: Omit<AuditEvent, 'ip' | 'userAgent'>): void {
  const enriched: AuditEvent = {
    ...event,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
  setImmediate(() => {
    void writeAudit(enriched).catch((err: unknown) => {
      logger.warn({ err, action: enriched.action }, 'Audit write failed');
    });
  });
}

async function writeAudit(event: AuditEvent): Promise<void> {
  // NOTE: actual DB write is implemented in apps/api/src/modules/auditing/service.ts
  // (Phase 8 / T134). For now we emit to the structured logger so events are not lost
  // while the auditing module is being scaffolded.
  logger.info({ audit: event }, 'audit_event');
}

export function attachAuditEmitter() {
  return (req: Request, res: Response, next: () => void) => {
    (req as Request & { audit: typeof emitAudit }).audit = emitAudit;
    res.on('finish', () => {
      // hook reserved for future per-request automatic audit
    });
    next();
  };
}
