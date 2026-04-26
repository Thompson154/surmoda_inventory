import {
  assertEncargadaOrAdmin,
  type StoreScopeRepo,
} from '../../shared/auth/storeScope';
import type { ReportRepository } from './repository';
import type { AuthContext, ReportSummary } from './types';

export interface ReportServiceDeps {
  reports: ReportRepository;
  scope: StoreScopeRepo;
}

export interface ReportService {
  getSummary(from: string, to: string, auth: AuthContext): Promise<ReportSummary>;
}

export function buildReportService({ reports, scope }: ReportServiceDeps): ReportService {
  return {
    async getSummary(from, to, auth) {
      // Admin or any encargada-anywhere. Vendedora blocked.
      await assertEncargadaOrAdmin(
        scope,
        auth,
        'STORE_FORBIDDEN',
        'Sólo admin o encargada pueden ver los reportes globales.',
      );
      return reports.buildSummary(from, to);
    },
  };
}
