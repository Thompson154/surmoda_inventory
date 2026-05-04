// Unit tests for sales business rules: discount cap, default subtotal.
// RED phase: written before implementation changes.

import { buildSaleService } from '../service';
import type { SaleRepository, SaleTx, CreateSaleItemRow } from '../repository';
import type { StoreScopeRepo } from '../../../shared/auth/storeScope';
import type { SaleWithItems } from '../types';
const FAKE_TX = {} as SaleTx;

function buildMockRepo(): jest.Mocked<SaleRepository> {
  const base: jest.Mocked<SaleRepository> = {
    loadStoreLockState: jest.fn().mockResolvedValue(null),
    loadVariantPrices: jest.fn(),
    variantsExistAndActive: jest.fn(),
    loadStockForVariants: jest.fn(),
    decrementStock: jest.fn().mockResolvedValue(10),
    createMovement: jest.fn().mockResolvedValue(undefined),
    createSale: jest.fn(),
    findIdempotentSale: jest.fn().mockResolvedValue(null),
    recordIdempotencyKey: jest.fn().mockResolvedValue(undefined),
    runSerializable: jest.fn(async (fn) => fn(FAKE_TX)),
    findSale: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    buildDashboard: jest.fn(),
  } as unknown as jest.Mocked<SaleRepository>;
  return base;
}

function buildMockScope(): jest.Mocked<StoreScopeRepo> {
  return {
    findActiveAssignment: jest.fn().mockResolvedValue({ role: 'vendedora' }),
    hasAnyEncargadaRole: jest.fn().mockResolvedValue(false),
  };
}

const ADMIN_AUTH = { userId: 'admin-1', isAdmin: true };
const STORE_ID = 'store-1';
const VARIANT_A = 'var-a';
// priceAtSaleCents = 10000 (100.00)
const PRICE_A = 10_000;

function fakeSaleWith(items: CreateSaleItemRow[]): SaleWithItems {
  return {
    id: 'sale-1',
    storeId: STORE_ID,
    storeName: 'Test Store',
    recordedByUserId: ADMIN_AUTH.userId,
    recordedByFullName: 'Admin User',
    paymentMethod: 'cash',
    totalCents: items.reduce((s, i) => s + i.subtotalCents, 0),
    itemCount: items.length,
    totalUnits: items.reduce((s, i) => s + i.quantity, 0),
    createdAt: new Date().toISOString(),
    items: items.map((i) => ({
      id: `item-${i.variantId}`,
      variantId: i.variantId,
      quantity: i.quantity,
      priceAtSaleCents: i.priceAtSaleCents,
      subtotalCents: i.subtotalCents,
      size: 'm' as const,
      color: 'negro',
      productName: 'Jean',
      productCode: 'JN001',
      barcode: '123456789012',
      imagePath: null,
      productId: `prod-${i.variantId}`,
    })),
  };
}

describe('SaleService — 30% discount cap', () => {
  let repo: jest.Mocked<SaleRepository>;
  let scope: jest.Mocked<StoreScopeRepo>;

  beforeEach(() => {
    repo = buildMockRepo();
    scope = buildMockScope();

    repo.variantsExistAndActive.mockResolvedValue(new Set([VARIANT_A]));
    repo.loadStockForVariants.mockResolvedValue(new Map([[VARIANT_A, 100]]));
    repo.loadVariantPrices.mockResolvedValue(new Map([[VARIANT_A, PRICE_A]]));
    // createSale is called after item rows are built — return minimal shape
    repo.createSale.mockResolvedValue({ id: 'sale-1' } as never);
    repo.findSale.mockResolvedValue(
      fakeSaleWith([
        {
          variantId: VARIANT_A,
          quantity: 1,
          priceAtSaleCents: PRICE_A,
          totalCents: PRICE_A,
          subtotalCents: PRICE_A,
        },
      ]),
    );
  });

  it('rejects subtotal below 70% of totalCents (>30% discount) with SALE_DISCOUNT_EXCEEDS_LIMIT', async () => {
    const service = buildSaleService({ sales: repo, assignments: scope });

    // 65% of total => exceeds 30% discount
    const subtotalCents = Math.floor(PRICE_A * 0.65); // 6500 < 7000 threshold

    await expect(
      service.create(
        STORE_ID,
        { items: [{ variantId: VARIANT_A, quantity: 1, subtotalCents }], paymentMethod: 'cash' },
        ADMIN_AUTH,
      ),
    ).rejects.toMatchObject({
      code: 'SALE_DISCOUNT_EXCEEDS_LIMIT',
      statusCode: 400,
    });
  });

  it('accepts subtotal exactly at 70% of totalCents (exactly 30% discount)', async () => {
    const service = buildSaleService({ sales: repo, assignments: scope });

    // exactly 70% => at the limit, should be accepted
    const subtotalCents = Math.ceil(PRICE_A * 0.7); // 7000

    const result = await service.create(
      STORE_ID,
      { items: [{ variantId: VARIANT_A, quantity: 1, subtotalCents }], paymentMethod: 'cash' },
      ADMIN_AUTH,
    );
    expect(result).toBeDefined();
  });

  it('accepts subtotal above 70% of totalCents (less than 30% discount)', async () => {
    const service = buildSaleService({ sales: repo, assignments: scope });

    const subtotalCents = Math.ceil(PRICE_A * 0.8); // 8000 — 20% discount

    const result = await service.create(
      STORE_ID,
      { items: [{ variantId: VARIANT_A, quantity: 1, subtotalCents }], paymentMethod: 'cash' },
      ADMIN_AUTH,
    );
    expect(result).toBeDefined();
  });
});

describe('SaleService — default subtotalCents = totalCents', () => {
  let repo: jest.Mocked<SaleRepository>;
  let scope: jest.Mocked<StoreScopeRepo>;
  let capturedRows: CreateSaleItemRow[] = [];

  beforeEach(() => {
    repo = buildMockRepo();
    scope = buildMockScope();
    capturedRows = [];

    repo.variantsExistAndActive.mockResolvedValue(new Set([VARIANT_A]));
    repo.loadStockForVariants.mockResolvedValue(new Map([[VARIANT_A, 100]]));
    repo.loadVariantPrices.mockResolvedValue(new Map([[VARIANT_A, PRICE_A]]));

    repo.createSale.mockImplementation(async (_header, rows) => {
      capturedRows = rows;
      return { id: 'sale-1' } as never;
    });
    repo.findSale.mockResolvedValue(
      fakeSaleWith([
        {
          variantId: VARIANT_A,
          quantity: 1,
          priceAtSaleCents: PRICE_A,
          totalCents: PRICE_A,
          subtotalCents: PRICE_A,
        },
      ]),
    );
  });

  it('persists subtotalCents = totalCents when no subtotal provided', async () => {
    const service = buildSaleService({ sales: repo, assignments: scope });

    await service.create(
      STORE_ID,
      { items: [{ variantId: VARIANT_A, quantity: 1 }], paymentMethod: 'cash' },
      ADMIN_AUTH,
    );

    expect(capturedRows).toHaveLength(1);
    expect(capturedRows[0]!.subtotalCents).toBe(PRICE_A * 1); // 1 unit × price
    expect(capturedRows[0]!.totalCents).toBe(capturedRows[0]!.subtotalCents);
  });

  it('persists provided subtotalCents when explicitly given', async () => {
    const service = buildSaleService({ sales: repo, assignments: scope });
    const explicit = 8_500;

    await service.create(
      STORE_ID,
      {
        items: [{ variantId: VARIANT_A, quantity: 1, subtotalCents: explicit }],
        paymentMethod: 'cash',
      },
      ADMIN_AUTH,
    );

    expect(capturedRows[0]!.subtotalCents).toBe(explicit);
  });
});
