// Unit tests for SalesReportService — TDD RED phase.
// Repositories are mocked; no DB or HTTP required.

import { buildSalesReportService } from '../salesReport.service';
import type { SalesReportRepository } from '../salesReport.repository';
import type { SalesReportService } from '../salesReport.service';
import type { SalesRow, PaymentSummary } from '../salesReport.types';
import type { StoreScopeRepo } from '../../../shared/auth/storeScope';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MockRepo = { [K in keyof SalesReportRepository]: jest.Mock };
type MockScope = { [K in keyof StoreScopeRepo]: jest.Mock };

function buildMockRepo(): MockRepo {
  return {
    findStore: jest.fn(),
    getSalesInPeriod: jest.fn(),
    getSalesTotalCount: jest.fn(),
    getSalesTotalAmount: jest.fn(),
    getPaymentTotals: jest.fn(),
    getSalesBatch: jest.fn().mockResolvedValue({ rows: [], lastCursor: undefined }),
    getLiveInventory: jest.fn(),
    getSnapshotInventory: jest.fn(),
  };
}

function buildMockScope(): MockScope {
  return {
    findActiveAssignment: jest.fn(),
    hasAnyEncargadaRole: jest.fn(),
  };
}

const ADMIN_AUTH = { userId: 'admin-1', isAdmin: true };
const ENCARGADA_AUTH = { userId: 'enc-1', isAdmin: false };
const VENDEDORA_AUTH = { userId: 'vend-1', isAdmin: false };

const STORE_ID = 'store-prado';
const OTHER_STORE_ID = 'store-zsur';

const STORE_INFO = { id: STORE_ID, name: 'Prado', code: 'PRADO' };

function makeDate(offsetDays = 0): Date {
  const d = new Date('2026-01-15T00:00:00.000Z');
  d.setDate(d.getDate() + offsetDays);
  return d;
}

const FROM = makeDate(0);
const TO = makeDate(5);

const MOCK_ROW: SalesRow = {
  saleDate: '2026-01-15',
  saleTime: '10:00:00',
  ticketNumber: 'sale-abc123',
  productCode: 'JEAN-001',
  variantDescription: 'Jean azul talla M',
  color: 'azul',
  size: 'm',
  quantity: 2,
  unitPriceCents: 10000,
  subtotalCents: 20000,
  paymentMethod: 'cash',
  cashier: 'vendedora.prado',
};

// ─── RBAC ─────────────────────────────────────────────────────────────────────

describe('SalesReportService — RBAC', () => {
  let repo: MockRepo;
  let scope: MockScope;
  let service: SalesReportService;

  beforeEach(() => {
    repo = buildMockRepo();
    scope = buildMockScope();
    service = buildSalesReportService({
      reports: repo as unknown as SalesReportRepository,
      scope: scope as unknown as StoreScopeRepo,
    });

    repo.findStore.mockResolvedValue(STORE_INFO);
    repo.getSalesInPeriod.mockResolvedValue([]);
    repo.getSalesTotalCount.mockResolvedValue(0);
    repo.getSalesTotalAmount.mockResolvedValue(0);
    repo.getPaymentTotals.mockResolvedValue({ cash: 0, card: 0, qr: 0, total: 0 });
    repo.getLiveInventory.mockResolvedValue([]);
  });

  it('admin can generate report for any storeId', async () => {
    const result = await service.generateSalesReport({
      requestingUser: ADMIN_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: false,
      includeInventory: false,
    });
    expect(result.store.id).toBe(STORE_ID);
    expect(scope.findActiveAssignment).not.toHaveBeenCalled();
    expect(scope.hasAnyEncargadaRole).not.toHaveBeenCalled();
  });

  it('encargada (global) can generate report for any storeId', async () => {
    scope.hasAnyEncargadaRole.mockResolvedValue(true);
    const result = await service.generateSalesReport({
      requestingUser: ENCARGADA_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: false,
      includeInventory: false,
    });
    expect(result.store.id).toBe(STORE_ID);
    expect(scope.hasAnyEncargadaRole).toHaveBeenCalledWith(ENCARGADA_AUTH.userId);
  });

  it('vendedora assigned to the store can generate a report for her storeId', async () => {
    scope.hasAnyEncargadaRole.mockResolvedValue(false);
    scope.findActiveAssignment.mockResolvedValue({ role: 'vendedora' });
    const result = await service.generateSalesReport({
      requestingUser: VENDEDORA_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: false,
      includeInventory: false,
    });
    expect(result.store.id).toBe(STORE_ID);
  });

  it('vendedora NOT assigned to the store gets 403', async () => {
    scope.hasAnyEncargadaRole.mockResolvedValue(false);
    scope.findActiveAssignment.mockResolvedValue(null);
    await expect(
      service.generateSalesReport({
        requestingUser: VENDEDORA_AUTH,
        storeId: OTHER_STORE_ID,
        from: FROM,
        to: TO,
        includePaymentSummary: false,
        includeInventory: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe('SalesReportService — date range validation', () => {
  let repo: MockRepo;
  let scope: MockScope;
  let service: SalesReportService;

  beforeEach(() => {
    repo = buildMockRepo();
    scope = buildMockScope();
    service = buildSalesReportService({
      reports: repo as unknown as SalesReportRepository,
      scope: scope as unknown as StoreScopeRepo,
    });
  });

  it('rejects when to <= from', async () => {
    await expect(
      service.generateSalesReport({
        requestingUser: ADMIN_AUTH,
        storeId: STORE_ID,
        from: TO,
        to: FROM,
        includePaymentSummary: false,
        includeInventory: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects when to === from (exact same datetime)', async () => {
    await expect(
      service.generateSalesReport({
        requestingUser: ADMIN_AUTH,
        storeId: STORE_ID,
        from: FROM,
        to: FROM,
        includePaymentSummary: false,
        includeInventory: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects when range exceeds 12 months with 400 and descriptive message', async () => {
    const farFuture = new Date(FROM);
    farFuture.setFullYear(farFuture.getFullYear() + 2);
    await expect(
      service.generateSalesReport({
        requestingUser: ADMIN_AUTH,
        storeId: STORE_ID,
        from: FROM,
        to: farFuture,
        includePaymentSummary: false,
        includeInventory: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('12') });
  });
});

// ─── Preview — sales section ──────────────────────────────────────────────────

describe('SalesReportService — preview sales section', () => {
  let repo: MockRepo;
  let scope: MockScope;
  let service: SalesReportService;

  beforeEach(() => {
    repo = buildMockRepo();
    scope = buildMockScope();
    service = buildSalesReportService({
      reports: repo as unknown as SalesReportRepository,
      scope: scope as unknown as StoreScopeRepo,
    });
    repo.findStore.mockResolvedValue(STORE_INFO);
    repo.getPaymentTotals.mockResolvedValue({ cash: 0, card: 0, qr: 0, total: 0 });
    repo.getLiveInventory.mockResolvedValue([]);
  });

  it('returns first 50 rows and totalRows from repo', async () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({ ...MOCK_ROW, ticketNumber: `sale-${i}` }));
    repo.getSalesInPeriod.mockResolvedValue(rows.slice(0, 50));
    repo.getSalesTotalCount.mockResolvedValue(80);
    repo.getSalesTotalAmount.mockResolvedValue(1_600_000);

    const result = await service.generateSalesReport({
      requestingUser: ADMIN_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: false,
      includeInventory: false,
    });

    expect(result.sales.rows).toHaveLength(50);
    expect(result.sales.totalRows).toBe(80);
    expect(result.sales.totalAmountCents).toBe(1_600_000);
  });

  it('generatedAt is a Date instance', async () => {
    repo.getSalesInPeriod.mockResolvedValue([]);
    repo.getSalesTotalCount.mockResolvedValue(0);
    repo.getSalesTotalAmount.mockResolvedValue(0);

    const result = await service.generateSalesReport({
      requestingUser: ADMIN_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: false,
      includeInventory: false,
    });

    expect(result.generatedAt).toBeInstanceOf(Date);
  });
});

// ─── Preview — paymentSummary section ────────────────────────────────────────

describe('SalesReportService — paymentSummary section', () => {
  let repo: MockRepo;
  let scope: MockScope;
  let service: SalesReportService;

  beforeEach(() => {
    repo = buildMockRepo();
    scope = buildMockScope();
    service = buildSalesReportService({
      reports: repo as unknown as SalesReportRepository,
      scope: scope as unknown as StoreScopeRepo,
    });
    repo.findStore.mockResolvedValue(STORE_INFO);
    repo.getSalesInPeriod.mockResolvedValue([]);
    repo.getSalesTotalCount.mockResolvedValue(0);
    repo.getSalesTotalAmount.mockResolvedValue(0);
    repo.getLiveInventory.mockResolvedValue([]);
  });

  it('paymentSummary is absent when includePaymentSummary=false', async () => {
    const result = await service.generateSalesReport({
      requestingUser: ADMIN_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: false,
      includeInventory: false,
    });
    expect(result.paymentSummary).toBeUndefined();
  });

  it('paymentSummary is present with correct totals when includePaymentSummary=true', async () => {
    const summary: PaymentSummary = { cash: 5000, card: 3000, qr: 2000, total: 10000 };
    repo.getPaymentTotals.mockResolvedValue(summary);

    const result = await service.generateSalesReport({
      requestingUser: ADMIN_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: true,
      includeInventory: false,
    });

    expect(result.paymentSummary).toBeDefined();
    expect(result.paymentSummary!.cash).toBe(5000);
    expect(result.paymentSummary!.card).toBe(3000);
    expect(result.paymentSummary!.qr).toBe(2000);
    expect(result.paymentSummary!.total).toBe(10000);
  });
});

// ─── Preview — inventory section ─────────────────────────────────────────────

describe('SalesReportService — inventory section', () => {
  let repo: MockRepo;
  let scope: MockScope;
  let service: SalesReportService;

  beforeEach(() => {
    repo = buildMockRepo();
    scope = buildMockScope();
    service = buildSalesReportService({
      reports: repo as unknown as SalesReportRepository,
      scope: scope as unknown as StoreScopeRepo,
    });
    repo.findStore.mockResolvedValue(STORE_INFO);
    repo.getSalesInPeriod.mockResolvedValue([]);
    repo.getSalesTotalCount.mockResolvedValue(0);
    repo.getSalesTotalAmount.mockResolvedValue(0);
    repo.getPaymentTotals.mockResolvedValue({ cash: 0, card: 0, qr: 0, total: 0 });
  });

  it('inventory section is absent when includeInventory=false', async () => {
    const result = await service.generateSalesReport({
      requestingUser: ADMIN_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: false,
      includeInventory: false,
    });
    expect(result.inventory).toBeUndefined();
  });

  it('inventory section is present when includeInventory=true', async () => {
    const liveRows = [
      {
        productCode: 'P1',
        variantDescription: 'Jean azul M',
        color: 'azul',
        size: 'm',
        quantity: 5,
        unitPriceCents: 10000,
      },
    ];
    repo.getLiveInventory.mockResolvedValue(liveRows);
    repo.getSnapshotInventory.mockResolvedValue(null);

    const result = await service.generateSalesReport({
      requestingUser: ADMIN_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: false,
      includeInventory: true,
    });

    expect(result.inventory).toBeDefined();
    expect(result.inventory!.rows.length).toBeGreaterThanOrEqual(0);
    expect(result.inventory!.totalVariants).toBeGreaterThanOrEqual(0);
    expect(result.inventory!.totalUnits).toBeGreaterThanOrEqual(0);
    expect(result.inventory!.capturedAt).toBeInstanceOf(Date);
  });

  it('uses snapshot when available (snapshot rows capped to first 50 in preview)', async () => {
    const snapshotRows = Array.from({ length: 60 }, (_, i) => ({
      productCode: `P${i}`,
      variantDescription: `Var ${i}`,
      color: 'negro',
      size: 'm',
      quantity: 1,
      unitPriceCents: 5000,
    }));
    const capturedAt = new Date('2026-01-10T03:00:00Z');
    repo.getSnapshotInventory.mockResolvedValue({ rows: snapshotRows, capturedAt });
    repo.getLiveInventory.mockResolvedValue([]);

    const result = await service.generateSalesReport({
      requestingUser: ADMIN_AUTH,
      storeId: STORE_ID,
      from: FROM,
      to: TO,
      includePaymentSummary: false,
      includeInventory: true,
    });

    expect(result.inventory!.rows.length).toBeLessThanOrEqual(50);
    expect(result.inventory!.totalVariants).toBe(60);
    expect(result.inventory!.capturedAt).toEqual(capturedAt);
  });
});

// ─── Store not found ──────────────────────────────────────────────────────────

describe('SalesReportService — store not found', () => {
  let repo: MockRepo;
  let scope: MockScope;
  let service: SalesReportService;

  beforeEach(() => {
    repo = buildMockRepo();
    scope = buildMockScope();
    service = buildSalesReportService({
      reports: repo as unknown as SalesReportRepository,
      scope: scope as unknown as StoreScopeRepo,
    });
  });

  it('throws 404 when store does not exist', async () => {
    repo.findStore.mockResolvedValue(null);
    await expect(
      service.generateSalesReport({
        requestingUser: ADMIN_AUTH,
        storeId: 'nonexistent-store',
        from: FROM,
        to: TO,
        includePaymentSummary: false,
        includeInventory: false,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
