import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
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
      // WHY: retroactive edit audit requires a reason for compliance — validate before fire-and-forget.
      if (input.action === 'DAILY_CLOSURE_RETROACTIVE_EDIT') {
        const reason = input.payload?.['reason'];
        if (typeof reason !== 'string' || reason.trim().length === 0) {
          throw new AppError(
            400,
            ERROR_CODES.DAILY_CLOSURE_RETROACTIVE_EDIT_REASON_REQUIRED,
            'El campo reason es obligatorio para ediciones retroactivas de cierre.',
          );
        }
      }

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
