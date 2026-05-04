// Controller for POST /api/v1/reports/sales.
// Handles both format=preview (JSON) and format=xlsx (streaming binary).

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { SalesReportBodySchema } from './salesReport.validators';
import type { SalesReportService } from './salesReport.service';
import type { SalesReportRepository } from './salesReport.repository';
import { writeSalesReportXlsx } from './excel/salesReportWriter';

export interface SalesReportController {
  generate(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function requireAuth(req: Request): { userId: string; isAdmin: boolean } {
  if (!req.auth) throw new AppError(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'No autenticado');
  return { userId: req.auth.userId, isAdmin: req.auth.isAdmin };
}

export function buildSalesReportController(
  service: SalesReportService,
  reports: SalesReportRepository,
): SalesReportController {
  return {
    async generate(req, res, next) {
      try {
        const auth = requireAuth(req);
        const input = SalesReportBodySchema.parse(req.body);

        const from = new Date(input.from);
        const to = new Date(input.to);

        if (input.format === 'preview') {
          // ── JSON preview ──────────────────────────────────────────────────
          const result = await service.generateSalesReport({
            requestingUser: auth,
            storeId: input.storeId,
            from,
            to,
            includePaymentSummary: input.includePaymentSummary,
            includeInventory: input.includeInventory,
          });

          // Serialize Dates to ISO strings for the JSON response
          res.status(200).json({
            store: result.store,
            period: {
              from: result.period.from.toISOString(),
              to: result.period.to.toISOString(),
            },
            sales: {
              rows: result.sales.rows,
              totalRows: result.sales.totalRows,
              totalAmountCents: result.sales.totalAmountCents,
            },
            paymentSummary: result.paymentSummary,
            inventory: result.inventory
              ? {
                  ...result.inventory,
                  capturedAt: result.inventory.capturedAt.toISOString(),
                }
              : undefined,
            generatedAt: result.generatedAt.toISOString(),
          });
        } else {
          // ── XLSX streaming ────────────────────────────────────────────────
          // Run RBAC + date validation + store lookup via the service first
          // so that if anything is wrong we return JSON error before touching headers.
          const result = await service.generateSalesReport({
            requestingUser: auth,
            storeId: input.storeId,
            from,
            to,
            includePaymentSummary: input.includePaymentSummary,
            includeInventory: input.includeInventory,
          });

          const { store } = result;
          const fromStr = from.toISOString().slice(0, 10);
          const toStr = to.toISOString().slice(0, 10);
          const filename = `reporte-ventas-${store.code}-${fromStr}-a-${toStr}.xlsx`;

          res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          );
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

          // Stream the xlsx directly to res
          await writeSalesReportXlsx({
            stream: res,
            store,
            from,
            to,
            includePaymentSummary: input.includePaymentSummary,
            includeInventory: input.includeInventory,
            paymentSummary: result.paymentSummary,
            inventory: result.inventory,
            reports,
            generatedAt: result.generatedAt,
          });

          // writeSalesReportXlsx calls workbook.commit() which ends the stream
          // so we do NOT call res.end() here — exceljs does it.
        }
      } catch (err) {
        next(err);
      }
    },
  };
}
