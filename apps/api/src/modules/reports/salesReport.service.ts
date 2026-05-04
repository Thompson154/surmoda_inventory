// Service for POST /api/v1/reports/sales.
// Enforces RBAC, date validation, and delegates data fetch to the repository.

import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { assertCanActOnStore } from '../../shared/auth/storeScope';
import type { StoreScopeRepo } from '../../shared/auth/storeScope';
import type { SalesReportRepository } from './salesReport.repository';
import type {
  GenerateSalesReportArgs,
  SalesReportResult,
  InventorySection,
} from './salesReport.types';

// 12 months in milliseconds: 366 days (safe upper bound for any 12-month window)
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const PREVIEW_LIMIT = 50;

export interface SalesReportServiceDeps {
  reports: SalesReportRepository;
  scope: StoreScopeRepo;
}

export interface SalesReportService {
  generateSalesReport(args: GenerateSalesReportArgs): Promise<SalesReportResult>;
}

export function buildSalesReportService({
  reports,
  scope,
}: SalesReportServiceDeps): SalesReportService {
  async function enforceAccess(
    storeId: string,
    auth: { userId: string; isAdmin: boolean },
  ): Promise<void> {
    await assertCanActOnStore(
      scope,
      storeId,
      auth,
      'REPORT_STORE_FORBIDDEN',
      'No tenés acceso a esta sede para generar reportes.',
    );
  }

  function validateRange(from: Date, to: Date): void {
    if (to.getTime() <= from.getTime()) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, '`to` debe ser posterior a `from`.');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'El rango máximo es 12 meses. Reducí el período seleccionado.',
      );
    }
  }

  return {
    async generateSalesReport({
      requestingUser,
      storeId,
      from,
      to,
      includePaymentSummary,
      includeInventory,
    }) {
      // 1. Validate date range first (cheap, no DB)
      validateRange(from, to);

      // 2. RBAC
      await enforceAccess(storeId, requestingUser);

      // 3. Resolve store
      const store = await reports.findStore(storeId);
      if (!store) {
        throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Sede no encontrada.');
      }

      // 4. Sales section (preview: first 50 rows)
      const [previewRows, totalRows, totalAmountCents] = await Promise.all([
        reports.getSalesInPeriod(storeId, from, to, PREVIEW_LIMIT),
        reports.getSalesTotalCount(storeId, from, to),
        reports.getSalesTotalAmount(storeId, from, to),
      ]);

      // 5. Payment summary (optional)
      let paymentSummary = undefined;
      if (includePaymentSummary) {
        paymentSummary = await reports.getPaymentTotals(storeId, from, to);
      }

      // 6. Inventory section (optional)
      let inventory: InventorySection | undefined = undefined;
      if (includeInventory) {
        // Try snapshot first (most recent capturedAt <= to)
        const snapshot = await reports.getSnapshotInventory(storeId, to);
        if (snapshot) {
          const previewInventoryRows = snapshot.rows.slice(0, PREVIEW_LIMIT);
          inventory = {
            rows: previewInventoryRows,
            totalVariants: snapshot.rows.length,
            totalUnits: snapshot.rows.reduce((s, r) => s + r.quantity, 0),
            capturedAt: snapshot.capturedAt,
          };
        } else {
          // Fallback: live stock
          const liveRows = await reports.getLiveInventory(storeId);
          const previewLiveRows = liveRows.slice(0, PREVIEW_LIMIT);
          inventory = {
            rows: previewLiveRows,
            totalVariants: liveRows.length,
            totalUnits: liveRows.reduce((s, r) => s + r.quantity, 0),
            capturedAt: new Date(),
          };
        }
      }

      return {
        store,
        period: { from, to },
        sales: { rows: previewRows, totalRows, totalAmountCents },
        paymentSummary,
        inventory,
        generatedAt: new Date(),
      };
    },
  };
}
