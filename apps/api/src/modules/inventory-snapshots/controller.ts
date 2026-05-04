import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { TriggerSnapshotBodySchema } from './validators';
import type { InventorySnapshotService } from './service';

export interface InventorySnapshotController {
  trigger(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export function buildInventorySnapshotController(
  service: InventorySnapshotService,
): InventorySnapshotController {
  return {
    async trigger(req, res, next) {
      try {
        if (!req.auth) {
          throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
        }
        if (!req.auth.isAdmin) {
          throw new AppError(
            403,
            ERROR_CODES.AUTH_FORBIDDEN_ROLE,
            'Solo admin puede ejecutar snapshots.',
          );
        }

        const body = TriggerSnapshotBodySchema.parse(req.body);

        let result;
        try {
          result = await service.captureSnapshot({ storeId: body.storeId });
        } catch (err) {
          // Unique constraint violation: a batch for this exact timestamp already exists.
          // The skipDuplicates in the repo silently ignores them, so in practice this
          // only fires when the caller explicitly passes the same capturedAt twice.
          if (
            err instanceof Error &&
            err.message.includes('Unique constraint failed') &&
            err.message.includes('inventory_snapshots')
          ) {
            throw new AppError(
              409,
              ERROR_CODES.SNAPSHOT_DUPLICATE,
              'Ya existe un snapshot para este timestamp. Esperá unos segundos e intentá de nuevo.',
            );
          }
          throw err;
        }

        res.status(201).json({
          snapshotted: result.snapshotted,
          capturedAt: result.capturedAt.toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  };
}
