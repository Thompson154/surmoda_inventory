// Unit tests for DeliveryEditRequestService — Wave 5.
// Repository is mocked; no DB required.

import { buildDeliveryEditRequestService } from '../deliveryEditRequest.service';
import type { DeliveryEditRequestRepository } from '../deliveryEditRequest.repository';
import type { DeliveryEditRequestService } from '../deliveryEditRequest.service';
import { AppError } from '../../../shared/errors/AppError';

type MockRepo = {
  [K in keyof DeliveryEditRequestRepository]: jest.Mock;
};

function buildMockRepo(): MockRepo {
  return {
    findDeliveryHeader: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    listByDelivery: jest.fn(),
    listAll: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
  };
}

const VALID_REASON =
  'La cantidad enviada no coincide con la realidad porque el lote llegó dañado en parte.';

describe('DeliveryEditRequestService.create', () => {
  let repo: MockRepo;
  let service: DeliveryEditRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildDeliveryEditRequestService({
      repo: repo as unknown as DeliveryEditRequestRepository,
    });
  });

  it('throws DELIVERY_NOT_FOUND when delivery does not exist', async () => {
    repo.findDeliveryHeader.mockResolvedValue(null);

    await expect(
      service.create({ deliveryId: 'no-existo', requesterId: 'u-1', reason: VALID_REASON }),
    ).rejects.toThrow(AppError);
  });

  it('throws DELIVERY_EDIT_REQUEST_CREATE_INVALID_STATUS when delivery is in draft', async () => {
    repo.findDeliveryHeader.mockResolvedValue({
      id: 'd-1',
      status: 'draft',
      toStoreId: 's-1',
      fromStoreId: null,
    });

    await expect(
      service.create({ deliveryId: 'd-1', requesterId: 'u-1', reason: VALID_REASON }),
    ).rejects.toThrow(AppError);
  });

  it('throws DELIVERY_EDIT_REQUEST_CREATE_INVALID_STATUS when delivery already received', async () => {
    repo.findDeliveryHeader.mockResolvedValue({
      id: 'd-1',
      status: 'received',
      toStoreId: 's-1',
      fromStoreId: null,
    });

    await expect(
      service.create({ deliveryId: 'd-1', requesterId: 'u-1', reason: VALID_REASON }),
    ).rejects.toThrow(AppError);
  });

  it('throws DELIVERY_EDIT_REQUEST_CREATE_REASON_TOO_SHORT when reason < 50 chars', async () => {
    repo.findDeliveryHeader.mockResolvedValue({
      id: 'd-1',
      status: 'sent',
      toStoreId: 's-1',
      fromStoreId: null,
    });

    await expect(
      service.create({ deliveryId: 'd-1', requesterId: 'u-1', reason: 'corto' }),
    ).rejects.toThrow(AppError);
  });

  it('persists pending request when delivery is sent and reason is valid', async () => {
    repo.findDeliveryHeader.mockResolvedValue({
      id: 'd-1',
      status: 'sent',
      toStoreId: 's-1',
      fromStoreId: null,
    });
    repo.create.mockResolvedValue({ id: 'der-1', status: 'pending' });

    const result = await service.create({
      deliveryId: 'd-1',
      requesterId: 'u-1',
      reason: VALID_REASON,
    });

    expect(result.id).toBe('der-1');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 'd-1', requesterId: 'u-1' }),
    );
  });
});

describe('DeliveryEditRequestService.approve', () => {
  let repo: MockRepo;
  let service: DeliveryEditRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildDeliveryEditRequestService({
      repo: repo as unknown as DeliveryEditRequestRepository,
    });
  });

  it('throws DELIVERY_EDIT_REQUEST_NOT_FOUND when not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.approve({ id: 'nope', reviewerId: 'admin-1' })).rejects.toThrow(AppError);
  });

  it('throws ALREADY_REVIEWED when status is approved', async () => {
    repo.findById.mockResolvedValue({ id: 'der-1', status: 'approved' });
    await expect(service.approve({ id: 'der-1', reviewerId: 'admin-1' })).rejects.toThrow(AppError);
  });

  it('updates status to approved on happy path', async () => {
    repo.findById.mockResolvedValue({ id: 'der-1', status: 'pending' });
    repo.approve.mockResolvedValue({ id: 'der-1', status: 'approved' });

    const result = await service.approve({ id: 'der-1', reviewerId: 'admin-1' });
    expect(result.status).toBe('approved');
  });
});

describe('DeliveryEditRequestService.reject', () => {
  let repo: MockRepo;
  let service: DeliveryEditRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildDeliveryEditRequestService({
      repo: repo as unknown as DeliveryEditRequestRepository,
    });
  });

  it('throws when rejectionReason is too short', async () => {
    repo.findById.mockResolvedValue({ id: 'der-1', status: 'pending' });
    await expect(
      service.reject({ id: 'der-1', reviewerId: 'admin-1', rejectionReason: ' ' }),
    ).rejects.toThrow(AppError);
  });

  it('updates status to rejected on happy path', async () => {
    repo.findById.mockResolvedValue({ id: 'der-1', status: 'pending' });
    repo.reject.mockResolvedValue({ id: 'der-1', status: 'rejected' });

    const result = await service.reject({
      id: 'der-1',
      reviewerId: 'admin-1',
      rejectionReason: 'No procede',
    });
    expect(result.status).toBe('rejected');
  });
});

describe('DeliveryEditRequestService.listByDelivery', () => {
  let repo: MockRepo;
  let service: DeliveryEditRequestService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildDeliveryEditRequestService({
      repo: repo as unknown as DeliveryEditRequestRepository,
    });
  });

  it('returns all rows when caller is admin', async () => {
    repo.listByDelivery.mockResolvedValue([
      { id: 'a', requesterId: 'u-1' },
      { id: 'b', requesterId: 'u-2' },
    ]);

    const result = await service.listByDelivery({
      deliveryId: 'd-1',
      callerId: 'admin-1',
      isAdmin: true,
    });
    expect(result).toHaveLength(2);
  });

  it('filters to only requester rows when caller is not admin', async () => {
    repo.listByDelivery.mockResolvedValue([
      { id: 'a', requesterId: 'u-1' },
      { id: 'b', requesterId: 'u-2' },
    ]);

    const result = await service.listByDelivery({
      deliveryId: 'd-1',
      callerId: 'u-1',
      isAdmin: false,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a');
  });
});
