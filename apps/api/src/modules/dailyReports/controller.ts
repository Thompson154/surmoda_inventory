import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { emitAudit } from '../../middleware/auditLogger';
import { CloseDayPayloadSchema, DailyReportDateParamSchema, ListDailyReportsQuerySchema } from './validators';
import type { AuthContext } from './types';
import type { DailyReportService } from './service';

export interface DailyReportController {
  closeToday(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  getByDate(req: Request, res: Response, next: NextFunction): Promise<void>;
  getItemsByDate(req: Request, res: Response, next: NextFunction): Promise<void>;
  listStaff(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  return { userId: req.auth.userId, isAdmin: req.auth.isAdmin };
}

function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${name} requerido`);
  return value;
}

export function buildDailyReportController(service: DailyReportService): DailyReportController {
  return {
    async closeToday(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        // Body is optional for backwards-compat with older clients — defaults to [].
        const body = CloseDayPayloadSchema.parse(req.body ?? {});
        const report = await service.closeToday(storeId, auth, body.attendedUserIds);
        emitAudit(req, {
          userId: auth.userId,
          action: 'DAILY_REPORT_CLOSED',
          entity: 'DailyReport',
          entityId: report.id,
          payload: {
            storeId,
            date: report.date,
            totalCents: report.totalCents,
            transactionsCount: report.transactionsCount,
            attendeeCount: report.attendees.length,
            autoClosed: false,
          },
        });
        res.status(200).json(report);
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const query = ListDailyReportsQuerySchema.parse(req.query);
        const result = await service.list(storeId, query, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async getByDate(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const dateRaw = requireParam(req, 'date');
        const date = DailyReportDateParamSchema.parse(dateRaw);
        const result = await service.getByDate(storeId, date, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async getItemsByDate(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const dateRaw = requireParam(req, 'date');
        const date = DailyReportDateParamSchema.parse(dateRaw);
        const result = await service.getItemsByDate(storeId, date, auth);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    async listStaff(req, res, next) {
      try {
        const auth = requireAuth(req);
        const storeId = requireParam(req, 'storeId');
        const result = await service.listStoreStaff(storeId, auth);
        res.status(200).json({ items: result });
      } catch (err) {
        next(err);
      }
    },
  };
}
