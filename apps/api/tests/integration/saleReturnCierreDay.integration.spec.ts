// Integration: verify that a sale_return movement SUBTRACTS from the cierre de día totals.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';
import { resetTestState } from './_shared/dbReset';
import { loginAs, bearer } from './_shared/fixtures';

const app = buildServer();
const db = getPrisma();

let vendedoraToken: string;
let pradoStoreId: string;
let testVariantId: string;
let testBarcode: string;
let testPriceCents: number;

beforeAll(async () => {
  vendedoraToken = await loginAs(app, 'vendedoraPrado');

  const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
  if (!prado) throw new Error('Seed missing PRADO store');
  pradoStoreId = prado.id;

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

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

describe('Cierre de día + sale_return integration', () => {
  beforeEach(async () => {
    await db.dailyReport.deleteMany({ where: { storeId: pradoStoreId } });
    await db.saleItem.deleteMany({});
    await db.sale.deleteMany({});
    await db.stockMovement.deleteMany({});
    // Set PRADO stock so we can register a sale (requires stock) then a return.
    await db.stockBySite.update({
      where: { variantId_storeId: { variantId: testVariantId, storeId: pradoStoreId } },
      data: { quantity: 50 },
    });
  });

  it('sale_return with paymentMethod=cash reduces cashCents in the day close', async () => {
    // Register a cash sale first.
    const saleRes = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraToken))
      .send({
        items: [{ variantId: testVariantId, quantity: 2 }],
        paymentMethod: 'cash',
      });
    expect(saleRes.status).toBe(201);

    const saleCash = saleRes.body.totalCents as number;

    // Register a cash return for one unit of the same variant.
    const returnRes = await request(app)
      .post('/api/v1/sales/returns')
      .set(bearer(vendedoraToken))
      .send({ storeId: pradoStoreId, barcode: testBarcode, paymentMethod: 'cash' });
    expect(returnRes.status).toBe(201);
    const returnCents = returnRes.body.unitPriceCents as number;
    expect(returnCents).toBe(testPriceCents);

    // Close the day — vendedora closes (Wave 2 RBAC: encargada is forbidden).
    const closeRes = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(vendedoraToken));
    expect(closeRes.status).toBe(200);

    // cashCents should equal saleCash - returnCents.
    expect(closeRes.body.cashCents).toBe(saleCash - returnCents);
    expect(closeRes.body.totalCents).toBe(saleCash - returnCents);
  });

  it('sale_return with paymentMethod=qr reduces qrCents', async () => {
    const saleRes = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraToken))
      .send({
        items: [{ variantId: testVariantId, quantity: 3 }],
        paymentMethod: 'qr',
      });
    expect(saleRes.status).toBe(201);
    const saleQr = saleRes.body.totalCents as number;

    const returnRes = await request(app)
      .post('/api/v1/sales/returns')
      .set(bearer(vendedoraToken))
      .send({ storeId: pradoStoreId, barcode: testBarcode, paymentMethod: 'qr' });
    expect(returnRes.status).toBe(201);
    const returnCents = returnRes.body.unitPriceCents as number;

    // WHY: vendedora closes — encargada forbidden per Wave 2 RBAC.
    const closeRes = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(vendedoraToken));
    expect(closeRes.status).toBe(200);

    expect(closeRes.body.qrCents).toBe(saleQr - returnCents);
    expect(closeRes.body.totalCents).toBe(saleQr - returnCents);
  });
});
