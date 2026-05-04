// Integration: POST /api/v1/sales/returns

import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';
import { resetTestState } from './_shared/dbReset';
import { loginAs, bearer } from './_shared/fixtures';

const app = buildServer();
const db = getPrisma();

let adminToken: string;
let encargadaToken: string;
let vendedoraPradoToken: string;
let vendedoraZsurToken: string;
let pradoStoreId: string;
let testVariantId: string;
let testBarcode: string;
let testPriceCents: number;

async function waitForAudit(action: string, attempts = 20): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    const row = await db.auditLog.findFirst({
      where: { action },
      orderBy: { timestamp: 'desc' },
    });
    if (row) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

beforeAll(async () => {
  adminToken = await loginAs(app, 'admin');
  encargadaToken = await loginAs(app, 'encargadaPrado');
  vendedoraPradoToken = await loginAs(app, 'vendedoraPrado');
  vendedoraZsurToken = await loginAs(app, 'vendedoraZsur');

  const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
  if (!prado) throw new Error('Seed missing PRADO store');
  pradoStoreId = prado.id;

  // Pick a variant that has a StockBySite row at PRADO.
  const stockRow = await db.stockBySite.findFirst({
    where: { storeId: pradoStoreId },
    include: { variant: true },
  });
  if (!stockRow) throw new Error('No stock rows for PRADO — check seed');
  testVariantId = stockRow.variantId;
  testBarcode = stockRow.variant.barcode;
  testPriceCents = stockRow.variant.priceCents;

  await resetTestState({ db, resetStockFor: 'all' });
});

beforeEach(async () => {
  await db.stockMovement.deleteMany({});
  // Reset PRADO stock to a known quantity so each test starts clean.
  await db.stockBySite.update({
    where: { variantId_storeId: { variantId: testVariantId, storeId: pradoStoreId } },
    data: { quantity: 10 },
  });
});

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

describe('POST /api/v1/sales/returns', () => {
  it('happy path: 201, stock incremented +1, movement persisted', async () => {
    const res = await request(app)
      .post('/api/v1/sales/returns')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        barcode: testBarcode,
        paymentMethod: 'cash',
        reason: 'Talla incorrecta',
      });

    expect(res.status).toBe(201);
    expect(res.body.movementId).toBeDefined();
    expect(res.body.barcode).toBe(testBarcode);
    expect(res.body.paymentMethod).toBe('cash');
    expect(res.body.unitPriceCents).toBe(testPriceCents);
    expect(res.body.balanceAfter).toBe(11);

    // Stock incremented by +1.
    const stock = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: testVariantId, storeId: pradoStoreId } },
    });
    expect(stock?.quantity).toBe(11);

    // Movement row persisted with correct type.
    const movement = await db.stockMovement.findFirst({
      where: { id: res.body.movementId },
    });
    expect(movement).not.toBeNull();
    expect(movement?.type).toBe('sale_return');

    // Audit eventually persisted (fire-and-forget).
    expect(await waitForAudit('SALE_RETURN_CREATE')).toBe(true);
  });

  it('defaults paymentMethod to cash when omitted', async () => {
    const res = await request(app)
      .post('/api/v1/sales/returns')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, barcode: testBarcode });

    expect(res.status).toBe(201);
    expect(res.body.paymentMethod).toBe('cash');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/sales/returns')
      .send({ storeId: pradoStoreId, barcode: testBarcode });

    expect(res.status).toBe(401);
  });

  it('returns 403 when vendedora belongs to a different store', async () => {
    const res = await request(app)
      .post('/api/v1/sales/returns')
      .set(bearer(vendedoraZsurToken))
      .send({ storeId: pradoStoreId, barcode: testBarcode, paymentMethod: 'cash' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SALES_RETURN_CREATE_FORBIDDEN_STORE');
  });

  it('returns 404 when barcode is unknown', async () => {
    const res = await request(app)
      .post('/api/v1/sales/returns')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, barcode: 'NONEXISTENT_BARCODE_XYZ', paymentMethod: 'cash' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SALES_RETURN_CREATE_INVALID_BARCODE');
  });

  it('vendedora of the store CAN create a return (RBAC accepts vendedora)', async () => {
    const res = await request(app)
      .post('/api/v1/sales/returns')
      .set(bearer(vendedoraPradoToken))
      .send({ storeId: pradoStoreId, barcode: testBarcode, paymentMethod: 'qr' });

    expect(res.status).toBe(201);
  });

  it('encargada CAN create a return (RBAC accepts encargada)', async () => {
    const res = await request(app)
      .post('/api/v1/sales/returns')
      .set(bearer(encargadaToken))
      .send({ storeId: pradoStoreId, barcode: testBarcode, paymentMethod: 'card' });

    expect(res.status).toBe(201);
  });

  it('returns 409 when variant has no inventory row at the store', async () => {
    // Use a variant that exists globally but has no StockBySite at PRADO.
    // Find a variant not in PRADO.
    const outsideVariant = await db.variant.findFirst({
      where: {
        stock: { none: { storeId: pradoStoreId } },
        deletedAt: null,
        isActive: true,
      },
    });

    if (!outsideVariant) {
      // Skip if all variants are in PRADO (seed-dependent edge case).
      console.warn('Skipping 409 test: all variants have stock at PRADO');
      return;
    }

    const res = await request(app)
      .post('/api/v1/sales/returns')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, barcode: outsideVariant.barcode, paymentMethod: 'cash' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SALES_RETURN_CREATE_VARIANT_NOT_IN_STORE');
  });
});
