// Unit tests for ReturnRequestService — TDD RED phase.
// Repository is mocked; no DB required.

import { buildReturnRequestService } from '../service';
import type { ReturnRequestRepository } from '../repository';
import type { ReturnRequestService } from '../service';
import { AppError } from '../../../shared/errors/AppError';

// ─── Helpers ────────────────────────────────────────────────────────────────

type MockRepo = {
  [K in keyof ReturnRequestRepository]: jest.Mock;
};

function buildMockRepo(): MockRepo {
  return {
    findVariantByBarcode: jest.fn(),
    findStockBySite: jest.fn(),
    findOriginalSaleItem: jest.fn(),
    createReturnRequest: jest.fn(),
    findReturnRequestsByRequester: jest.fn(),
    findAllReturnRequests: jest.fn(),
    findReturnRequestById: jest.fn(),
    approveReturnRequest: jest.fn(),
    rejectReturnRequest: jest.fn(),
    listClosuresWithSales: jest.fn(),
  };
}

const BASE_DATE = new Date('2026-04-28T12:00:00.000Z'); // today = 2026-04-28

// ─── createReturnRequest ─────────────────────────────────────────────────────

describe('ReturnRequestService.createReturnRequest', () => {
  let repo: MockRepo;
  let service: ReturnRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildReturnRequestService({ repo: repo as unknown as ReturnRequestRepository });
  });

  it('creates a return request with pending status', async () => {
    repo.findVariantByBarcode.mockResolvedValueOnce({ id: 'var-returned' });
    repo.findVariantByBarcode.mockResolvedValueOnce(null); // no exchange
    repo.createReturnRequest.mockResolvedValue({
      id: 'rr-1',
      status: 'pending',
      requesterId: 'user-1',
    });

    const result = await service.createReturnRequest({
      requesterId: 'user-1',
      storeId: 'store-1',
      returnedVariantBarcode: 'BAR001',
      returnedQuantity: 1,
      saleDate: BASE_DATE,
      reason: 'Talla incorrecta',
    });

    expect(result.status).toBe('pending');
    expect(repo.createReturnRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: 'user-1',
        returnedVariantId: 'var-returned',
        status: 'pending',
      }),
    );
  });

  it('throws 404 when returnedVariantBarcode not found', async () => {
    repo.findVariantByBarcode.mockResolvedValue(null);

    await expect(
      service.createReturnRequest({
        requesterId: 'user-1',
        storeId: 'store-1',
        returnedVariantBarcode: 'INVALID',
        returnedQuantity: 1,
        saleDate: BASE_DATE,
        reason: 'Producto roto',
      }),
    ).rejects.toThrow(AppError);

    const call = repo.findVariantByBarcode.mock.calls[0] as [string];
    expect(call[0]).toBe('INVALID');
  });

  it('throws 400 when saleDate older than 7 days', async () => {
    repo.findVariantByBarcode.mockResolvedValue({ id: 'var-1' });

    const oldDate = new Date(BASE_DATE);
    oldDate.setDate(oldDate.getDate() - 8); // 8 days ago

    await expect(
      service.createReturnRequest({
        requesterId: 'user-1',
        storeId: 'store-1',
        returnedVariantBarcode: 'BAR001',
        returnedQuantity: 1,
        saleDate: oldDate,
        reason: 'Defectuoso',
      }),
    ).rejects.toThrow(AppError);
  });

  it('throws 400 when reason is empty string', async () => {
    repo.findVariantByBarcode.mockResolvedValue({ id: 'var-1' });

    await expect(
      service.createReturnRequest({
        requesterId: 'user-1',
        storeId: 'store-1',
        returnedVariantBarcode: 'BAR001',
        returnedQuantity: 1,
        saleDate: BASE_DATE,
        reason: '  ',
      }),
    ).rejects.toThrow(AppError);
  });

  it('resolves exchangeVariantBarcode if provided', async () => {
    repo.findVariantByBarcode
      .mockResolvedValueOnce({ id: 'var-returned' })
      .mockResolvedValueOnce({ id: 'var-exchange' });
    repo.createReturnRequest.mockResolvedValue({ id: 'rr-2', status: 'pending' });

    await service.createReturnRequest({
      requesterId: 'user-1',
      storeId: 'store-1',
      returnedVariantBarcode: 'BAR001',
      returnedQuantity: 1,
      saleDate: BASE_DATE,
      exchangeVariantBarcode: 'BAR002',
      reason: 'Quiero otro talle',
    });

    expect(repo.findVariantByBarcode).toHaveBeenCalledWith('BAR002');
    expect(repo.createReturnRequest).toHaveBeenCalledWith(
      expect.objectContaining({ exchangeVariantId: 'var-exchange' }),
    );
  });

  it('throws 404 when exchangeVariantBarcode not found', async () => {
    repo.findVariantByBarcode
      .mockResolvedValueOnce({ id: 'var-returned' })
      .mockResolvedValueOnce(null);

    await expect(
      service.createReturnRequest({
        requesterId: 'user-1',
        storeId: 'store-1',
        returnedVariantBarcode: 'BAR001',
        returnedQuantity: 1,
        saleDate: BASE_DATE,
        exchangeVariantBarcode: 'INVALID',
        reason: 'Otro talle',
      }),
    ).rejects.toThrow(AppError);
  });
});

// ─── listMine ────────────────────────────────────────────────────────────────

describe('ReturnRequestService.listMine', () => {
  let repo: MockRepo;
  let service: ReturnRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildReturnRequestService({ repo: repo as unknown as ReturnRequestRepository });
  });

  it('returns paginated list for the requester', async () => {
    const rows = [{ id: 'rr-1', status: 'pending', requesterId: 'user-1' }];
    repo.findReturnRequestsByRequester.mockResolvedValue({ rows, total: 1 });

    const result = await service.listMine({
      requesterId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('passes status filter to repo when provided', async () => {
    repo.findReturnRequestsByRequester.mockResolvedValue({ rows: [], total: 0 });

    await service.listMine({ requesterId: 'user-1', status: 'approved', page: 1, pageSize: 20 });

    expect(repo.findReturnRequestsByRequester).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' }),
    );
  });
});

// ─── listAll ─────────────────────────────────────────────────────────────────

describe('ReturnRequestService.listAll', () => {
  let repo: MockRepo;
  let service: ReturnRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildReturnRequestService({ repo: repo as unknown as ReturnRequestRepository });
  });

  it('returns paginated list of all requests', async () => {
    const rows = [{ id: 'rr-1' }, { id: 'rr-2' }];
    repo.findAllReturnRequests.mockResolvedValue({ rows, total: 2 });

    const result = await service.listAll({ page: 1, pageSize: 20 });
    expect(result.total).toBe(2);
  });

  it('passes filters to repo', async () => {
    repo.findAllReturnRequests.mockResolvedValue({ rows: [], total: 0 });

    await service.listAll({
      storeId: 'store-1',
      requesterId: 'user-2',
      status: 'rejected',
      page: 1,
      pageSize: 10,
    });

    expect(repo.findAllReturnRequests).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-1', requesterId: 'user-2', status: 'rejected' }),
    );
  });
});

// ─── getById ─────────────────────────────────────────────────────────────────

describe('ReturnRequestService.getById', () => {
  let repo: MockRepo;
  let service: ReturnRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildReturnRequestService({ repo: repo as unknown as ReturnRequestRepository });
  });

  it('returns the request when admin calls', async () => {
    repo.findReturnRequestById.mockResolvedValue({ id: 'rr-1', requesterId: 'user-1' });

    const result = await service.getById({ id: 'rr-1', callerId: 'admin-user', isAdmin: true });
    expect(result.id).toBe('rr-1');
  });

  it('returns the request when the requester calls', async () => {
    repo.findReturnRequestById.mockResolvedValue({ id: 'rr-1', requesterId: 'user-1' });

    const result = await service.getById({ id: 'rr-1', callerId: 'user-1', isAdmin: false });
    expect(result.id).toBe('rr-1');
  });

  it('throws 403 when non-admin non-requester calls', async () => {
    repo.findReturnRequestById.mockResolvedValue({ id: 'rr-1', requesterId: 'user-1' });

    await expect(
      service.getById({ id: 'rr-1', callerId: 'other-user', isAdmin: false }),
    ).rejects.toThrow(AppError);
  });

  it('throws 404 when request not found', async () => {
    repo.findReturnRequestById.mockResolvedValue(null);

    await expect(
      service.getById({ id: 'not-found', callerId: 'user-1', isAdmin: true }),
    ).rejects.toThrow(AppError);
  });
});

// ─── approve ─────────────────────────────────────────────────────────────────

describe('ReturnRequestService.approve', () => {
  let repo: MockRepo;
  let service: ReturnRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildReturnRequestService({ repo: repo as unknown as ReturnRequestRepository });
  });

  it('throws 409 when request is already reviewed (approved)', async () => {
    repo.findReturnRequestById.mockResolvedValue({
      id: 'rr-1',
      status: 'approved',
      requesterId: 'user-1',
      storeId: 'store-1',
      returnedVariantId: 'var-1',
      returnedQuantity: 1,
    });

    await expect(service.approve({ id: 'rr-1', reviewerId: 'admin-1' })).rejects.toThrow(AppError);
  });

  it('throws 409 when request is already reviewed (rejected)', async () => {
    repo.findReturnRequestById.mockResolvedValue({
      id: 'rr-1',
      status: 'rejected',
      requesterId: 'user-1',
      storeId: 'store-1',
      returnedVariantId: 'var-1',
      returnedQuantity: 1,
    });

    await expect(service.approve({ id: 'rr-1', reviewerId: 'admin-1' })).rejects.toThrow(AppError);
  });

  it('throws 404 when request not found', async () => {
    repo.findReturnRequestById.mockResolvedValue(null);

    await expect(service.approve({ id: 'not-found', reviewerId: 'admin-1' })).rejects.toThrow(
      AppError,
    );
  });

  it('throws 409 when exchange variant has insufficient stock', async () => {
    repo.findReturnRequestById.mockResolvedValue({
      id: 'rr-1',
      status: 'pending',
      requesterId: 'user-1',
      storeId: 'store-1',
      returnedVariantId: 'var-returned',
      returnedQuantity: 2,
      exchangeVariantId: 'var-exchange',
    });
    // stock = 1, need = 2
    repo.findStockBySite.mockResolvedValue({ quantity: 1 });
    repo.approveReturnRequest.mockResolvedValue({ id: 'rr-1', status: 'approved' });

    await expect(service.approve({ id: 'rr-1', reviewerId: 'admin-1' })).rejects.toThrow(AppError);
  });

  it('calls approveReturnRequest with correct params on happy path (no exchange)', async () => {
    repo.findReturnRequestById.mockResolvedValue({
      id: 'rr-1',
      status: 'pending',
      requesterId: 'user-1',
      storeId: 'store-1',
      returnedVariantId: 'var-returned',
      returnedQuantity: 1,
      exchangeVariantId: null,
    });
    repo.approveReturnRequest.mockResolvedValue({ id: 'rr-1', status: 'approved' });

    const result = await service.approve({ id: 'rr-1', reviewerId: 'admin-1' });

    expect(repo.approveReturnRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rr-1',
        reviewerId: 'admin-1',
        hasExchange: false,
      }),
    );
    expect(result.status).toBe('approved');
  });

  it('calls approveReturnRequest with hasExchange=true when exchange exists and stock sufficient', async () => {
    repo.findReturnRequestById.mockResolvedValue({
      id: 'rr-1',
      status: 'pending',
      requesterId: 'user-1',
      storeId: 'store-1',
      returnedVariantId: 'var-returned',
      returnedQuantity: 1,
      exchangeVariantId: 'var-exchange',
    });
    repo.findStockBySite.mockResolvedValue({ quantity: 5 });
    repo.approveReturnRequest.mockResolvedValue({ id: 'rr-1', status: 'approved' });

    const result = await service.approve({ id: 'rr-1', reviewerId: 'admin-1' });

    expect(repo.approveReturnRequest).toHaveBeenCalledWith(
      expect.objectContaining({ hasExchange: true }),
    );
    expect(result.status).toBe('approved');
  });
});

// ─── reject ──────────────────────────────────────────────────────────────────

describe('ReturnRequestService.reject', () => {
  let repo: MockRepo;
  let service: ReturnRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildReturnRequestService({ repo: repo as unknown as ReturnRequestRepository });
  });

  it('throws 409 when request is already reviewed', async () => {
    repo.findReturnRequestById.mockResolvedValue({
      id: 'rr-1',
      status: 'approved',
      requesterId: 'user-1',
    });

    await expect(
      service.reject({ id: 'rr-1', reviewerId: 'admin-1', rejectionReason: 'No procede' }),
    ).rejects.toThrow(AppError);
  });

  it('throws 404 when request not found', async () => {
    repo.findReturnRequestById.mockResolvedValue(null);

    await expect(
      service.reject({ id: 'not-found', reviewerId: 'admin-1', rejectionReason: 'Motivo' }),
    ).rejects.toThrow(AppError);
  });

  it('throws 400 when rejectionReason is blank', async () => {
    repo.findReturnRequestById.mockResolvedValue({
      id: 'rr-1',
      status: 'pending',
      requesterId: 'user-1',
    });

    await expect(
      service.reject({ id: 'rr-1', reviewerId: 'admin-1', rejectionReason: '  ' }),
    ).rejects.toThrow(AppError);
  });

  it('calls rejectReturnRequest with correct params on happy path', async () => {
    repo.findReturnRequestById.mockResolvedValue({
      id: 'rr-1',
      status: 'pending',
      requesterId: 'user-1',
    });
    repo.rejectReturnRequest.mockResolvedValue({ id: 'rr-1', status: 'rejected' });

    const result = await service.reject({
      id: 'rr-1',
      reviewerId: 'admin-1',
      rejectionReason: 'No cumple política',
    });

    expect(repo.rejectReturnRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rr-1',
        reviewerId: 'admin-1',
        rejectionReason: 'No cumple política',
      }),
    );
    expect(result.status).toBe('rejected');
  });
});

// ─── Wave 5 — original-sale validation on create ─────────────────────────────

describe('ReturnRequestService.createReturnRequest — Wave 5 original-sale block', () => {
  let repo: MockRepo;
  let service: ReturnRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildReturnRequestService({ repo: repo as unknown as ReturnRequestRepository });
  });

  it('throws RETURN_REQUEST_CREATE_ORIGINAL_SALE_NOT_FOUND when originalSale lookup returns null', async () => {
    repo.findVariantByBarcode.mockResolvedValue({ id: 'var-1' });
    repo.findOriginalSaleItem.mockResolvedValue(null);

    await expect(
      service.createReturnRequest({
        requesterId: 'user-1',
        storeId: 'store-1',
        returnedVariantBarcode: 'BAR001',
        returnedQuantity: 1,
        saleDate: BASE_DATE,
        reason: 'Talla incorrecta',
        originalSaleId: 'sale-x',
        originalSaleItemId: 'si-x',
        originalClosureDate: BASE_DATE,
        originalPaymentMethod: 'cash',
        originalSubtotalCents: 5000,
        newPaymentMethod: 'cash',
        newSubtotalCents: 5000,
      }),
    ).rejects.toThrow(AppError);

    expect(repo.findOriginalSaleItem).toHaveBeenCalledWith('sale-x', 'si-x', 'store-1');
  });

  it('throws ORIGINAL_SALE_NOT_FOUND when returned barcode does not match the saleItem variant', async () => {
    repo.findVariantByBarcode.mockResolvedValue({ id: 'var-1' });
    repo.findOriginalSaleItem.mockResolvedValue({
      saleId: 'sale-x',
      saleItemId: 'si-x',
      storeId: 'store-1',
      variantId: 'var-other',
      variantBarcode: 'BARDIFF',
    });

    await expect(
      service.createReturnRequest({
        requesterId: 'user-1',
        storeId: 'store-1',
        returnedVariantBarcode: 'BAR001',
        returnedQuantity: 1,
        saleDate: BASE_DATE,
        reason: 'Defectuoso',
        originalSaleId: 'sale-x',
        originalSaleItemId: 'si-x',
        originalClosureDate: BASE_DATE,
        originalPaymentMethod: 'cash',
        originalSubtotalCents: 5000,
        newPaymentMethod: 'qr',
        newSubtotalCents: 5000,
      }),
    ).rejects.toThrow(AppError);
  });

  it('passes through original-sale block to repo when validation succeeds', async () => {
    repo.findVariantByBarcode.mockResolvedValueOnce({ id: 'var-1' });
    repo.findOriginalSaleItem.mockResolvedValue({
      saleId: 'sale-x',
      saleItemId: 'si-x',
      storeId: 'store-1',
      variantId: 'var-1',
      variantBarcode: 'BAR001',
    });
    repo.createReturnRequest.mockResolvedValue({ id: 'rr-w5', status: 'pending' });

    await service.createReturnRequest({
      requesterId: 'user-1',
      storeId: 'store-1',
      returnedVariantBarcode: 'BAR001',
      returnedQuantity: 1,
      saleDate: BASE_DATE,
      reason: 'Talla incorrecta',
      originalSaleId: 'sale-x',
      originalSaleItemId: 'si-x',
      originalClosureDate: BASE_DATE,
      originalPaymentMethod: 'cash',
      originalSubtotalCents: 5000,
      newPaymentMethod: 'qr',
      newSubtotalCents: 6000,
    });

    expect(repo.createReturnRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        originalSaleId: 'sale-x',
        originalSaleItemId: 'si-x',
        originalPaymentMethod: 'cash',
        originalSubtotalCents: 5000,
        newPaymentMethod: 'qr',
        newSubtotalCents: 6000,
      }),
    );
  });
});

// ─── Wave 5 — approve passthrough of replacement data ────────────────────────

describe('ReturnRequestService.approve — Wave 5 replacement passthrough', () => {
  let repo: MockRepo;
  let service: ReturnRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildReturnRequestService({ repo: repo as unknown as ReturnRequestRepository });
  });

  it('forwards originalSaleItemId + new payment data to the repo on approve', async () => {
    repo.findReturnRequestById.mockResolvedValue({
      id: 'rr-1',
      status: 'pending',
      requesterId: 'user-1',
      storeId: 'store-1',
      returnedVariantId: 'var-returned',
      returnedQuantity: 1,
      exchangeVariantId: 'var-exchange',
      originalSaleItemId: 'si-orig',
      newPaymentMethod: 'qr',
      newSubtotalCents: 7500,
    });
    repo.findStockBySite.mockResolvedValue({ quantity: 5 });
    repo.approveReturnRequest.mockResolvedValue({ id: 'rr-1', status: 'approved' });

    await service.approve({ id: 'rr-1', reviewerId: 'admin-1' });

    expect(repo.approveReturnRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        originalSaleItemId: 'si-orig',
        newPaymentMethod: 'qr',
        newSubtotalCents: 7500,
        hasExchange: true,
      }),
    );
  });
});

// ─── Wave 5 — listClosuresWithSales delegation ───────────────────────────────

describe('ReturnRequestService.listClosuresWithSales', () => {
  let repo: MockRepo;
  let service: ReturnRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildReturnRequestService({ repo: repo as unknown as ReturnRequestRepository });
  });

  it('delegates to repo.listClosuresWithSales with the provided storeIds', async () => {
    repo.listClosuresWithSales.mockResolvedValue([
      { closureDate: '2026-04-28', closureId: 'c-1', sales: [] },
    ]);

    const result = await service.listClosuresWithSales({ storeIds: ['store-1'] });
    expect(result).toHaveLength(1);
    expect(repo.listClosuresWithSales).toHaveBeenCalledWith(
      expect.objectContaining({ storeIds: ['store-1'] }),
    );
  });
});
