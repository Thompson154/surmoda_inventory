import type { Request, Response } from 'express';
import type { AuditAction, AuditEntity, AuditWriteInput, AuditService } from '../modules/auditing';

export type { AuditAction, AuditEntity, AuditWriteInput };

export interface AuditEvent {
  userId?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

// WHY: write is fire-and-forget via AuditService (setImmediate internally).
// Constitution PARTE VI § 6.2 — audit MUST NOT add measurable latency.
export function emitAudit(req: Request, event: Omit<AuditEvent, 'ip' | 'userAgent'>): void {
  const service = (req.app.locals as { auditService?: AuditService }).auditService;
  if (!service) return;

  service.write({
    ...event,
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });
}

export function attachAuditEmitter(auditService: AuditService) {
  return (req: Request, res: Response, next: () => void) => {
    req.app.locals.auditService = auditService;
    res.on('finish', () => {
      // hook reserved for future per-request automatic audit
    });
    next();
  };
}
