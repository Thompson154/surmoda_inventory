// Single source of truth for "can this user act on this store?".
//
// Three roles in play:
//   - admin            → unrestricted
//   - encargada-global → any user with at least one assignment of role=encargada
//                        operates as a global encargada (sees every store, opens
//                        every cierre, etc.). This is the post-feature-004 fix
//                        agreed by product.
//   - vendedora        → only the specific store(s) listed in her active
//                        UserStore rows.
//
// All sales/inventory/deliveries/dailyReport services delegate to the helpers
// here so the matrix never drifts between modules.

import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../constants/errorCodes';

export interface StoreAssignment {
  role: 'encargada' | 'vendedora';
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}

export interface StoreScopeRepo {
  findActiveAssignment(userId: string, storeId: string): Promise<StoreAssignment | null>;
  hasAnyEncargadaRole(userId: string): Promise<boolean>;
}

/** Allow admin or any encargada (global). Vendedora always denied. */
export async function assertEncargadaOrAdmin(
  scope: StoreScopeRepo,
  auth: AuthContext,
  forbiddenCode: keyof typeof ERROR_CODES,
  message: string,
): Promise<void> {
  if (auth.isAdmin) return;
  if (await scope.hasAnyEncargadaRole(auth.userId)) return;
  throw new AppError(403, ERROR_CODES[forbiddenCode], message);
}

/**
 * Allow admin or vendedora assigned to the store. Encargada is explicitly forbidden.
 * WHY: sales creation is vendedora-only — encargada is a supervisory role.
 */
export async function assertVendedoraOrAdmin(
  scope: StoreScopeRepo,
  storeId: string,
  auth: AuthContext,
  forbiddenCode: keyof typeof ERROR_CODES,
  message: string,
): Promise<void> {
  if (auth.isAdmin) return;
  if (await scope.hasAnyEncargadaRole(auth.userId)) {
    throw new AppError(403, ERROR_CODES[forbiddenCode], message);
  }
  const a = await scope.findActiveAssignment(auth.userId, storeId);
  if (a) return;
  throw new AppError(403, ERROR_CODES[forbiddenCode], message);
}

/**
 * Allow admin, any encargada (global), OR vendedora explicitly assigned to the store.
 * The store-scoped services (sales, deliveries, inventory) use this on every read/write.
 */
export async function assertCanActOnStore(
  scope: StoreScopeRepo,
  storeId: string,
  auth: AuthContext,
  forbiddenCode: keyof typeof ERROR_CODES,
  message: string,
): Promise<void> {
  if (auth.isAdmin) return;
  if (await scope.hasAnyEncargadaRole(auth.userId)) return;
  const a = await scope.findActiveAssignment(auth.userId, storeId);
  if (a) return;
  throw new AppError(403, ERROR_CODES[forbiddenCode], message);
}
