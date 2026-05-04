// Unit tests for SaleReturnService — strict TDD: these are written BEFORE implementation.

import { buildSaleReturnService, type SaleReturnService } from '../salesReturn.service';
import type { SaleReturnRepository } from '../salesReturn.repository';
import type { StoreScopeRepo } from '../../../shared/auth/storeScope';

// ─── Mocks ───────────────────────────────────────────────────────────────────

interface MockRepo {
  findVariantByBarcode: jest.Mock;
  findStockBySite: jest.Mock;
  incrementStock: jest.Mock;
  createMovement: jest.Mock;
  runTransaction: jest.Mock;
}

function buildMockRepo(overrides: Partial<MockRepo> = {}): MockRepo {
  const base: MockRepo = {
    findVariantByBarcode: jest.fn(),
    findStockBySite: jest.fn(),
    incrementStock: jest.fn(),
    createMovement: jest.fn().mockResolvedValue(undefined),
    runTransaction: jest.fn(),
    ...overrides,
  };
  // WHY: runTransaction executes the callback with a fake tx so service logic runs.
  base.runTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
  return base;
}

function buildMockScope(): jest.Mocked<StoreScopeRepo> {
  return {
    findActiveAssignment: jest.fn().mockResolvedValue({ role: 'vendedora' }),
    hasAnyEncargadaRole: jest.fn().mockResolvedValue(false),
  };
}

const AUTH_VENDEDORA = { userId: 'u-vendedora', isAdmin: false };
const AUTH_ADMIN = { userId: 'u-admin', isAdmin: true };

const FAKE_VARIANT = {
  id: 'var-001',
  barcode: 'BARCODE123',
  priceCents: 25000,
};

const FAKE_STOCK = { quantity: 5 };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SaleReturnService.create', () => {
  let repo: MockRepo;
  let scope: jest.Mocked<StoreScopeRepo>;
  let service: SaleReturnService;

  beforeEach(() => {
    repo = buildMockRepo();
    scope = buildMockScope();
    repo.findVariantByBarcode.mockResolvedValue(FAKE_VARIANT);
    repo.findStockBySite.mockResolvedValue(FAKE_STOCK);
    repo.incrementStock.mockResolvedValue(6);
    repo.createMovement.mockResolvedValue({ id: 'mov-1' });
    service = buildSaleReturnService({
      saleReturn: repo as unknown as SaleReturnRepository,
      assignments: scope,
    });
  });

  it('defaults paymentMethod to cash when omitted', async () => {
    await service.create({ storeId: 'store-1', barcode: 'BARCODE123' }, AUTH_VENDEDORA);

    expect(repo.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ paymentMethod: 'cash' }),
      }),
      expect.anything(),
    );
  });

  it('increments stock by exactly +1', async () => {
    await service.create(
      { storeId: 'store-1', barcode: 'BARCODE123', paymentMethod: 'card' },
      AUTH_VENDEDORA,
    );

    expect(repo.incrementStock).toHaveBeenCalledWith('store-1', 'var-001', 1, expect.anything());
  });

  it('emits a sale_return StockMovement with correct payload shape', async () => {
    repo.incrementStock.mockResolvedValue(6);

    await service.create(
      {
        storeId: 'store-1',
        barcode: 'BARCODE123',
        paymentMethod: 'qr',
        reason: 'Talla incorrecta',
      },
      AUTH_VENDEDORA,
    );

    expect(repo.createMovement).toHaveBeenCalledWith(
      {
        storeId: 'store-1',
        variantId: 'var-001',
        userId: 'u-vendedora',
        type: 'sale_return',
        payload: {
          quantity: 1,
          balanceAfter: 6,
          paymentMethod: 'qr',
          unitPriceCents: 25000,
          reason: 'Talla incorrecta',
        },
      },
      expect.anything(),
    );
  });

  it('throws SALES_RETURN_CREATE_INVALID_BARCODE (404) when barcode unknown', async () => {
    repo.findVariantByBarcode.mockResolvedValue(null);

    await expect(
      service.create({ storeId: 'store-1', barcode: 'UNKNOWN' }, AUTH_VENDEDORA),
    ).rejects.toMatchObject({
      code: 'SALES_RETURN_CREATE_INVALID_BARCODE',
      statusCode: 404,
    });
  });

  it('throws SALES_RETURN_CREATE_VARIANT_NOT_IN_STORE (409) when no inventory row', async () => {
    repo.findStockBySite.mockResolvedValue(null);

    await expect(
      service.create({ storeId: 'store-1', barcode: 'BARCODE123' }, AUTH_VENDEDORA),
    ).rejects.toMatchObject({
      code: 'SALES_RETURN_CREATE_VARIANT_NOT_IN_STORE',
      statusCode: 409,
    });
  });

  it('rolls back transaction on failure: stock stays unchanged', async () => {
    // Simulate createMovement throwing AFTER incrementStock — transaction should roll back.
    // We verify the service propagates the error (real rollback is DB-level in integration tests).
    repo.createMovement.mockRejectedValue(new Error('DB write failed'));

    await expect(
      service.create({ storeId: 'store-1', barcode: 'BARCODE123' }, AUTH_VENDEDORA),
    ).rejects.toThrow('DB write failed');
  });

  it('admin can create a return without store assignment', async () => {
    scope.findActiveAssignment.mockResolvedValue(null);

    await expect(
      service.create({ storeId: 'store-1', barcode: 'BARCODE123' }, AUTH_ADMIN),
    ).resolves.toBeDefined();
  });

  it('throws SALES_RETURN_CREATE_FORBIDDEN_STORE (403) when vendedora has no assignment', async () => {
    scope.findActiveAssignment.mockResolvedValue(null);
    scope.hasAnyEncargadaRole.mockResolvedValue(false);

    await expect(
      service.create({ storeId: 'store-1', barcode: 'BARCODE123' }, AUTH_VENDEDORA),
    ).rejects.toMatchObject({
      code: 'SALES_RETURN_CREATE_FORBIDDEN_STORE',
      statusCode: 403,
    });
  });
});
