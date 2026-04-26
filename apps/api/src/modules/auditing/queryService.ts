// Audit query service. RBAC: admin OR any encargada (global).
// Vendedora is forbidden — same matrix as the reports endpoint, since both
// surface cross-store information.

import type { AuditLogListResponse } from '@surmoda/contracts';
import {
  assertEncargadaOrAdmin,
  type AuthContext,
  type StoreScopeRepo,
} from '../../shared/auth/storeScope';
import type { AuditQueryFilters, AuditRepository } from './repository';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export interface AuditQueryServiceDeps {
  audit: AuditRepository;
  scope: StoreScopeRepo;
}

export interface AuditQueryService {
  list(
    raw: { userId?: string; storeId?: string; page?: number; pageSize?: number },
    auth: AuthContext,
  ): Promise<AuditLogListResponse>;
}

export function buildAuditQueryService({ audit, scope }: AuditQueryServiceDeps): AuditQueryService {
  return {
    async list(raw, auth) {
      await assertEncargadaOrAdmin(
        scope,
        auth,
        'STORE_FORBIDDEN',
        'Sólo admin o encargada pueden ver el log de auditoría.',
      );

      const page = Math.max(1, Math.floor(raw.page ?? 1));
      const pageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Math.floor(raw.pageSize ?? DEFAULT_PAGE_SIZE)),
      );
      const filters: AuditQueryFilters = {
        userId: raw.userId,
        storeId: raw.storeId,
        page,
        pageSize,
      };
      return audit.list(filters);
    },
  };
}
