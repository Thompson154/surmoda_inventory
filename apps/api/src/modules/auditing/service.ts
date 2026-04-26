import type { Database } from '../../infrastructure/database';
import { Prisma } from '../../infrastructure/database';
import { logger } from '../../infrastructure/logger';
import type { AuditWriteInput } from './types';
import { sanitizeAuditPayload } from './sanitize';

export interface AuditService {
  write(input: AuditWriteInput): void;
}

export function buildAuditService(db: Database): AuditService {
  return {
    write(input) {
      // WHY: setImmediate fire-and-forget — audit MUST NOT block the request lifecycle
      // (per research R5 in specs/001-auth-roles).
      setImmediate(() => {
        db.auditLog
          .create({
            data: {
              userId: input.userId ?? null,
              action: input.action,
              entity: input.entity,
              entityId: input.entityId ?? null,
              // Defense-in-depth: redact any accidentally-included secrets
              // BEFORE the row is persisted. See sanitize.ts for the rule set.
              payload: sanitizeAuditPayload(input.payload) as Prisma.InputJsonValue,
              ip: input.ip ?? null,
              userAgent: input.userAgent ?? null,
            },
          })
          .catch((err) => {
            // Never throw — log and move on. Audit failures must not crash the app.
            logger.error({ err, action: input.action }, 'audit write failed');
          });
      });
    },
  };
}
