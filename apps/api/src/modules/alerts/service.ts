import type { AlertsResponse } from '@surmoda/contracts';
import { assertEncargadaOrAdmin, type StoreScopeRepo } from '../../shared/auth/storeScope';
import type { AlertsRepository } from './repository';

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}

export interface AlertsServiceDeps {
  alerts: AlertsRepository;
  scope: StoreScopeRepo;
}

export interface AlertsService {
  list(auth: AuthContext, storeId?: string): Promise<AlertsResponse>;
}

export function buildAlertsService({ alerts, scope }: AlertsServiceDeps): AlertsService {
  return {
    async list(auth, storeId?: string) {
      // Admin or any encargada-anywhere. Vendedora gets 403.
      await assertEncargadaOrAdmin(
        scope,
        auth,
        'STORE_FORBIDDEN',
        'Sólo admin o encargada pueden ver las alertas operativas.',
      );
      return alerts.buildAlerts(storeId);
    },
  };
}
