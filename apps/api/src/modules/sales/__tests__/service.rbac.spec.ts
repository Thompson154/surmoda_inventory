// Unit tests for sales RBAC: encargada cannot create sales.
// RED phase: written before service fix.

import { buildSaleService } from '../service';
import type { SaleRepository, SaleTx } from '../repository';
import type { StoreScopeRepo } from '../../../shared/auth/storeScope';
import type { AuthContext } from '../types';

const FAKE_TX = {} as SaleTx;

function buildMockRepo(): jest.Mocked<SaleRepository> {
  return {
    loadStoreLockState: jest.fn().mockResolvedValue(null),
    loadVariantPrices: jest.fn().mockResolvedValue(new Map([['var-a', 10_000]])),
    variantsExistAndActive: jest.fn().mockResolvedValue(new Set(['var-a'])),
    loadStockForVariants: jest.fn().mockResolvedValue(new Map([['var-a', 100]])),
    decrementStock: jest.fn().mockResolvedValue(99),
    createMovement: jest.fn().mockResolvedValue(undefined),
    createSale: jest.fn().mockResolvedValue({ id: 'sale-1' }),
    findIdempotentSale: jest.fn().mockResolvedValue(null),
    recordIdempotencyKey: jest.fn().mockResolvedValue(undefined),
    runSerializable: jest.fn(async (fn) => fn(FAKE_TX)),
    findSale: jest.fn().mockResolvedValue({
      id: 'sale-1',
      storeId: 'store-1',
      recordedByUserId: 'u1',
      paymentMethod: 'cash',
      totalCents: 10_000,
      itemCount: 1,
      totalUnits: 1,
      createdAt: new Date().toISOString(),
      items: [],
    }),
    findById: jest.fn(),
    list: jest.fn(),
    buildDashboard: jest.fn(),
  } as unknown as jest.Mocked<SaleRepository>;
}

const STORE_ID = 'store-1';
const ITEM = { variantId: 'var-a', quantity: 1 };

describe('SaleService.create — RBAC', () => {
  it('allows vendedora to create a sale', async () => {
    const repo = buildMockRepo();
    const scope: StoreScopeRepo = {
      findActiveAssignment: jest.fn().mockResolvedValue({ role: 'vendedora' }),
      hasAnyEncargadaRole: jest.fn().mockResolvedValue(false),
    };
    const service = buildSaleService({ sales: repo, assignments: scope });
    const auth: AuthContext = { userId: 'vend-1', isAdmin: false };

    await expect(
      service.create(STORE_ID, { items: [ITEM], paymentMethod: 'cash' }, auth),
    ).resolves.toBeDefined();
  });

  it('allows admin to create a sale', async () => {
    const repo = buildMockRepo();
    const scope: StoreScopeRepo = {
      findActiveAssignment: jest.fn().mockResolvedValue(null),
      hasAnyEncargadaRole: jest.fn().mockResolvedValue(false),
    };
    const service = buildSaleService({ sales: repo, assignments: scope });
    const auth: AuthContext = { userId: 'admin-1', isAdmin: true };

    await expect(
      service.create(STORE_ID, { items: [ITEM], paymentMethod: 'cash' }, auth),
    ).resolves.toBeDefined();
  });

  it('forbids encargada from creating a sale', async () => {
    const repo = buildMockRepo();
    // WHY: encargada oversees stores but does not register sales — vendedora does.
    const scope: StoreScopeRepo = {
      findActiveAssignment: jest.fn().mockResolvedValue({ role: 'encargada' }),
      hasAnyEncargadaRole: jest.fn().mockResolvedValue(true),
    };
    const service = buildSaleService({ sales: repo, assignments: scope });
    const auth: AuthContext = { userId: 'enc-1', isAdmin: false };

    await expect(
      service.create(STORE_ID, { items: [ITEM], paymentMethod: 'cash' }, auth),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
