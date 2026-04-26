import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { emitAudit } from '../../middleware/auditLogger';
import { CreateVariantSchema, UpdateVariantSchema } from './validators';
import type { VariantService } from './service.variant';
import type { ImageMimeType, UploadInput } from './imageStorage';
import { ALLOWED_MIME_TYPES, MAX_IMAGE_BYTES, sniffImageFormat } from './imageStorage';

const ORIGINAL_NAME_MAX_LENGTH = 255;

export interface VariantController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  update(req: Request, res: Response, next: NextFunction): Promise<void>;
  deactivate(req: Request, res: Response, next: NextFunction): Promise<void>;
  reactivate(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  }
  return req.auth;
}

function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${name} requerido`);
  }
  return value;
}

function readImage(req: Request): UploadInput | undefined {
  const file = req.file;
  if (!file) return undefined;

  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError(
      400,
      ERROR_CODES.VARIANT_IMAGE_TOO_LARGE,
      'La imagen supera el tamaño máximo permitido.',
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype as ImageMimeType)) {
    throw new AppError(
      400,
      ERROR_CODES.VARIANT_IMAGE_INVALID_TYPE,
      'Formato de imagen inválido (PNG, JPG o WebP).',
    );
  }
  // Defense in depth: the multer-reported MIME type comes from the client and
  // is forgeable. Re-derive the format from the buffer's magic bytes and
  // reject any mismatch — protects against renamed-extension uploads
  // (e.g. shell.php → shell.jpg).
  const sniffed = sniffImageFormat(file.buffer);
  if (sniffed === 'unknown' || sniffed !== file.mimetype) {
    throw new AppError(
      400,
      ERROR_CODES.VARIANT_IMAGE_INVALID_TYPE,
      'El contenido del archivo no coincide con un formato de imagen soportado.',
    );
  }
  if (file.originalname.length > ORIGINAL_NAME_MAX_LENGTH) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Nombre del archivo demasiado largo.',
    );
  }

  return {
    buffer: file.buffer,
    mimetype: file.mimetype as ImageMimeType,
    originalName: file.originalname,
  };
}

export function buildVariantController(service: VariantService): VariantController {
  return {
    async create(req, res, next) {
      try {
        const auth = requireAuth(req);
        const productId = requireParam(req, 'productId');
        const input = CreateVariantSchema.parse(req.body);
        const image = readImage(req);

        const variant = await service.create(productId, input, image);
        emitAudit(req, {
          userId: auth.userId,
          action: 'VARIANT_CREATED',
          entity: 'Variant',
          entityId: variant.id,
          payload: {
            productId,
            size: variant.size,
            color: variant.color,
            barcode: variant.barcode,
            priceCents: variant.priceCents,
          },
        });
        res.status(201).json(variant);
      } catch (err) {
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        const auth = requireAuth(req);
        const id = requireParam(req, 'id');
        const input = UpdateVariantSchema.parse(req.body);
        const image = readImage(req);

        const variant = await service.update(id, input, image);
        emitAudit(req, {
          userId: auth.userId,
          action: 'VARIANT_UPDATED',
          entity: 'Variant',
          entityId: variant.id,
          payload: { changes: input, imageUpdated: Boolean(image) },
        });
        res.status(200).json(variant);
      } catch (err) {
        next(err);
      }
    },

    async deactivate(req, res, next) {
      try {
        const auth = requireAuth(req);
        const id = requireParam(req, 'id');
        const variant = await service.deactivate(id);
        emitAudit(req, {
          userId: auth.userId,
          action: 'VARIANT_DEACTIVATED',
          entity: 'Variant',
          entityId: variant.id,
          payload: {},
        });
        res.status(200).json(variant);
      } catch (err) {
        next(err);
      }
    },

    async reactivate(req, res, next) {
      try {
        const auth = requireAuth(req);
        const id = requireParam(req, 'id');
        const variant = await service.reactivate(id);
        emitAudit(req, {
          userId: auth.userId,
          action: 'VARIANT_REACTIVATED',
          entity: 'Variant',
          entityId: variant.id,
          payload: {},
        });
        res.status(200).json(variant);
      } catch (err) {
        next(err);
      }
    },
  };
}
