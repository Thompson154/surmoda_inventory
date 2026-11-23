import { buildDeliveryService } from '../service';
import type { DeliveryRepository, DeliveryTx } from '../repository';

const FAKE_TX = {} as DeliveryTx;

describe('DeliveryService — warehouse & transfer & partial confirmation rules', () => {
  function setup() {
    const deliveries = {
      variantsExistAndActive: jest.fn().mockResolvedValue(new Set(['var-1'])),
      findActiveWarehouse: jest.fn().mockResolvedValue({ id: 'store-wh', name: 'Almacén Central' }),
      createDelivery: jest.fn(),
      findDelivery: jest.fn(),
      loadForUpdate: jest.fn(),
      setReceivedQuantity: jest.fn().mockResolvedValue(undefined),
      recordAdjustments: jest.fn().mockResolvedValue(undefined),
      createMovement: jest.fn().mockResolvedValue(undefined),
      incrementStock: jest.fn().mockResolvedValue(10),
      decrementStock: jest.fn().mockResolvedValue(5),
      setStatus: jest.fn().mockResolvedValue(undefined),
      deleteDelivery: jest.fn().mockResolvedValue(undefined),
      revertReception: jest.fn().mockResolvedValue(undefined),
      runSerializable: jest.fn(async (fn: (tx: DeliveryTx) => Promise<unknown>) => fn(FAKE_TX)),
    };
    const stores = {
      findById: jest.fn(),
    };
    const assignments = {
      findActiveAssignment: jest.fn(),
      hasAnyEncargadaRole: jest.fn().mockResolvedValue(true),
      hasWarehouseEncargadaRole: jest.fn().mockResolvedValue(false),
    };
    const service = buildDeliveryService({
      deliveries: deliveries as unknown as DeliveryRepository,
      stores,
      assignments,
    });
    return { deliveries, stores, assignments, service };
  }

  it('rejects branch-to-warehouse transfer when fromStoreId is sent to warehouse', async () => {
    const { stores, service } = setup();
    stores.findById.mockResolvedValue({ id: 'store-wh', kind: 'warehouse' });

    await expect(
      service.create(
        'store-wh',
        {
          fromStoreId: 'store-online',
          items: [{ variantId: 'var-1', quantity: 2 }],
        },
        { userId: 'liz-1', isAdmin: false },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects branch-only encargada dispatching from warehouse without warehouse access', async () => {
    const { stores, assignments, service } = setup();
    stores.findById.mockResolvedValue({ id: 'store-online', kind: 'branch' });
    assignments.hasWarehouseEncargadaRole.mockResolvedValue(false);
    assignments.findActiveAssignment.mockResolvedValue(null);

    await expect(
      service.create(
        'store-online',
        {
          items: [{ variantId: 'var-1', quantity: 2 }],
        },
        { userId: 'liz-1', isAdmin: false },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'DELIVERY_FORBIDDEN',
    });
  });

  it('allows origin branch reader to inspect outgoing transfer details via getById', async () => {
    const { deliveries, assignments, service } = setup();
    deliveries.findDelivery.mockResolvedValue({
      id: 'del-1',
      fromStoreId: 'store-online',
      toStoreId: 'store-prado',
    });
    assignments.findActiveAssignment.mockImplementation(async (_u: string, storeId: string) =>
      storeId === 'store-online' ? { role: 'encargada' } : null,
    );

    const result = await service.getById('del-1', { userId: 'liz-1', isAdmin: false });
    expect(result.id).toBe('del-1');
  });

  it('partial receive marks status=partial WITHOUT crediting destination stock yet', async () => {
    const { deliveries, assignments, service } = setup();
    assignments.findActiveAssignment.mockResolvedValue({ role: 'encargada' });
    deliveries.loadForUpdate.mockResolvedValue({
      id: 'del-2',
      status: 'sent',
      kind: 'distribution',
      title: 'Envío prueba',
      fromStoreId: 'store-wh',
      toStoreId: 'store-online',
      items: [{ id: 'di-1', variantId: 'var-1', quantity: 11, receivedQuantity: null }],
    });
    deliveries.findDelivery.mockResolvedValue({ id: 'del-2', status: 'partial' });

    const res = await service.receive(
      'del-2',
      { items: [{ deliveryItemId: 'di-1', receivedQuantity: 10, reason: 'Falta 1' }] },
      { userId: 'liz-1', isAdmin: false },
    );

    expect(res.status).toBe('partial');
    expect(deliveries.setReceivedQuantity).toHaveBeenCalledWith('di-1', 10, FAKE_TX);
    expect(deliveries.incrementStock).not.toHaveBeenCalled();
    expect(deliveries.setStatus).toHaveBeenCalledWith(
      'del-2',
      'partial',
      expect.any(Object),
      'liz-1',
      FAKE_TX,
    );
  });

  it('confirmPartial forbids receiving branch from self-confirming', async () => {
    const { deliveries, assignments, service } = setup();
    assignments.hasWarehouseEncargadaRole.mockResolvedValue(false);
    assignments.findActiveAssignment.mockResolvedValue(null);
    deliveries.loadForUpdate.mockResolvedValue({
      id: 'del-2',
      status: 'partial',
      kind: 'distribution',
      title: 'Envío prueba',
      fromStoreId: 'store-wh',
      toStoreId: 'store-online',
      items: [{ id: 'di-1', variantId: 'var-1', quantity: 11, receivedQuantity: 10 }],
    });

    await expect(
      service.confirmPartial('del-2', {}, { userId: 'liz-1', isAdmin: false }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'DELIVERY_FORBIDDEN' });
  });

  it('confirmPartial credits destination confirmed qty (+10) and refunds origin diff (+1) with status=partial_confirmed', async () => {
    const { deliveries, assignments, service } = setup();
    assignments.hasWarehouseEncargadaRole.mockResolvedValue(true);
    deliveries.loadForUpdate.mockResolvedValue({
      id: 'del-2',
      status: 'partial',
      kind: 'distribution',
      title: 'Envío prueba',
      fromStoreId: 'store-wh',
      toStoreId: 'store-online',
      items: [{ id: 'di-1', variantId: 'var-1', quantity: 11, receivedQuantity: 10 }],
    });
    deliveries.findDelivery.mockResolvedValue({
      id: 'del-2',
      status: 'partial_confirmed',
    });

    const res = await service.confirmPartial(
      'del-2',
      { items: [{ deliveryItemId: 'di-1', confirmedQuantity: 10 }] },
      { userId: 'gloria-1', isAdmin: false },
    );

    expect(res.status).toBe('partial_confirmed');
    expect(deliveries.incrementStock).toHaveBeenCalledWith('store-online', 'var-1', 10, FAKE_TX);
    expect(deliveries.incrementStock).toHaveBeenCalledWith('store-wh', 'var-1', 1, FAKE_TX);
    expect(deliveries.setStatus).toHaveBeenCalledWith(
      'del-2',
      'partial_confirmed',
      {},
      null,
      FAKE_TX,
    );
  });

  it('deleteSent forbids non-admin users (403 DELIVERY_FORBIDDEN)', async () => {
    const { service } = setup();
    await expect(
      service.deleteSent('del-sent', { userId: 'enc-1', isAdmin: false }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'DELIVERY_FORBIDDEN',
    });
  });

  it('deleteSent rejects invalid status deliveries (409 DELIVERY_INVALID_STATE)', async () => {
    const { deliveries, service } = setup();
    deliveries.loadForUpdate.mockResolvedValue({
      id: 'del-inv',
      status: 'unknown_status' as unknown as 'sent',
      kind: 'distribution',
      title: 'Invalida',
      fromStoreId: 'store-wh',
      toStoreId: 'store-online',
      items: [{ id: 'di-1', variantId: 'var-1', quantity: 5, receivedQuantity: 5 }],
    });

    await expect(
      service.deleteSent('del-inv', { userId: 'admin-1', isAdmin: true }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DELIVERY_INVALID_STATE',
    });
    expect(deliveries.deleteDelivery).not.toHaveBeenCalled();
  });

  it('deleteSent refunds origin stock and deletes sent delivery when called by admin', async () => {
    const { deliveries, service } = setup();
    deliveries.loadForUpdate.mockResolvedValue({
      id: 'del-sent',
      number: 16,
      status: 'sent',
      kind: 'distribution',
      title: 'Nuevo Ingreso',
      fromStoreId: 'store-wh',
      toStoreId: 'store-zsur',
      items: [{ id: 'di-1', variantId: 'var-1', quantity: 2, receivedQuantity: null }],
    });

    const result = await service.deleteSent('del-sent', { userId: 'admin-1', isAdmin: true });

    expect(result).toEqual({
      id: 'del-sent',
      number: 16,
      fromStoreId: 'store-wh',
      toStoreId: 'store-zsur',
      totalUnits: 2,
    });
    expect(deliveries.incrementStock).toHaveBeenCalledWith('store-wh', 'var-1', 2, FAKE_TX);
    expect(deliveries.deleteDelivery).toHaveBeenCalledWith('del-sent', FAKE_TX);
  });

  it('deleteSent refunds origin stock and deletes partial delivery when called by admin', async () => {
    const { deliveries, service } = setup();
    deliveries.loadForUpdate.mockResolvedValue({
      id: 'del-partial',
      number: 44,
      status: 'partial',
      kind: 'distribution',
      title: 'Parcial',
      fromStoreId: 'store-wh',
      toStoreId: 'store-zsur',
      items: [{ id: 'di-1', variantId: 'var-1', quantity: 3, receivedQuantity: 0 }],
    });

    const result = await service.deleteSent('del-partial', { userId: 'admin-1', isAdmin: true });

    expect(result).toEqual({
      id: 'del-partial',
      number: 44,
      fromStoreId: 'store-wh',
      toStoreId: 'store-zsur',
      totalUnits: 3,
    });
    expect(deliveries.incrementStock).toHaveBeenCalledWith('store-wh', 'var-1', 3, FAKE_TX);
    expect(deliveries.deleteDelivery).toHaveBeenCalledWith('del-partial', FAKE_TX);
  });

  it('deleteSent reverts destination stock and refunds origin for received delivery', async () => {
    const { deliveries, service } = setup();
    deliveries.loadForUpdate.mockResolvedValue({
      id: 'del-rec',
      number: 45,
      status: 'received',
      kind: 'distribution',
      title: 'Recibida',
      fromStoreId: 'store-wh',
      toStoreId: 'store-zsur',
      items: [{ id: 'di-1', variantId: 'var-1', quantity: 5, receivedQuantity: 5 }],
    });

    const result = await service.deleteSent('del-rec', { userId: 'admin-1', isAdmin: true });

    expect(result).toEqual({
      id: 'del-rec',
      number: 45,
      fromStoreId: 'store-wh',
      toStoreId: 'store-zsur',
      totalUnits: 5,
    });
    expect(deliveries.decrementStock).toHaveBeenCalledWith('store-zsur', 'var-1', 5, FAKE_TX);
    expect(deliveries.incrementStock).toHaveBeenCalledWith('store-wh', 'var-1', 5, FAKE_TX);
    expect(deliveries.deleteDelivery).toHaveBeenCalledWith('del-rec', FAKE_TX);
  });

  it('revertReception reverts partial delivery back to sent', async () => {
    const { deliveries, service } = setup();
    deliveries.loadForUpdate.mockResolvedValue({
      id: 'del-partial',
      status: 'partial',
      kind: 'distribution',
      title: 'Parcial',
      fromStoreId: 'store-wh',
      toStoreId: 'store-zsur',
      items: [{ id: 'di-1', variantId: 'var-1', quantity: 3, receivedQuantity: 0 }],
    });
    deliveries.findDelivery.mockResolvedValue({
      id: 'del-partial',
      status: 'sent',
    });

    const result = await service.revertReception('del-partial', {
      userId: 'admin-1',
      isAdmin: true,
    });

    expect(result.status).toBe('sent');
    expect(deliveries.revertReception).toHaveBeenCalledWith('del-partial', FAKE_TX);
  });

  it('revertReception rejects non-partial delivery (409)', async () => {
    const { deliveries, service } = setup();
    deliveries.loadForUpdate.mockResolvedValue({
      id: 'del-sent',
      status: 'sent',
      kind: 'distribution',
      title: 'Enviada',
      fromStoreId: 'store-wh',
      toStoreId: 'store-zsur',
      items: [{ id: 'di-1', variantId: 'var-1', quantity: 3, receivedQuantity: null }],
    });

    await expect(
      service.revertReception('del-sent', { userId: 'admin-1', isAdmin: true }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DELIVERY_INVALID_STATE',
    });
  });
});
