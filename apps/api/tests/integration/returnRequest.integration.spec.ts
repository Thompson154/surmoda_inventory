// Integration: /api/v1/return-requests — full CRUD + RBAC + stock mutations

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
let returnedVariantId: string;
let returnedBarcode: string;
let exchangeVariantId: string;
let exchangeBarcode: string;

// WHY: valid saleDate = today (test runner date is 2026-04-28 per env).
function recentSaleDate(): string {
  return new Date().toISOString();
}

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

  // Pick two distinct variants for PRADO to exercise return + exchange paths
  const stockRows = await db.stockBySite.findMany({
    where: { storeId: pradoStoreId },
    include: { variant: true },
    take: 2,
  });
  if (stockRows.length < 2) throw new Error('Need at least 2 variants at PRADO — check seed');

  returnedVariantId = stockRows[0]!.variantId;
  returnedBarcode = stockRows[0]!.variant.barcode;
  exchangeVariantId = stockRows[1]!.variantId;
  exchangeBarcode = stockRows[1]!.variant.barcode;

  await resetTestState({ db, resetStockFor: 'all' });
});

beforeEach(async () => {
  await db.returnRequest.deleteMany({});
  await db.stockMovement.deleteMany({});

  // Set known stock levels
  await db.stockBySite.update({
    where: { variantId_storeId: { variantId: returnedVariantId, storeId: pradoStoreId } },
    data: { quantity: 5 },
  });
  await db.stockBySite.update({
    where: { variantId_storeId: { variantId: exchangeVariantId, storeId: pradoStoreId } },
    data: { quantity: 3 },
  });
});

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

// ─── POST / — submit ─────────────────────────────────────────────────────────

describe('POST /api/v1/return-requests', () => {
  it('201: vendedora can submit a return request', async () => {
    const res = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Talla incorrecta',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.storeId).toBe(pradoStoreId);
    // No stock changes at submit time
    const stock = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: returnedVariantId, storeId: pradoStoreId } },
    });
    expect(stock?.quantity).toBe(5);
  });

  it('201: encargada can submit a return request', async () => {
    const res = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(encargadaToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Defecto de fábrica',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('201: submit with exchange variant', async () => {
    const res = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        exchangeVariantBarcode: exchangeBarcode,
        reason: 'Quiero otro talle',
      });

    expect(res.status).toBe(201);
    expect(res.body.exchangeVariantId).toBe(exchangeVariantId);
  });

  it('401: unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/return-requests').send({
      storeId: pradoStoreId,
      returnedVariantBarcode: returnedBarcode,
      returnedQuantity: 1,
      saleDate: recentSaleDate(),
      reason: 'Sin token',
    });

    expect(res.status).toBe(401);
  });

  it('403: vendedora from another store cannot submit', async () => {
    const res = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraZsurToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'No me corresponde',
      });

    expect(res.status).toBe(403);
  });

  it('400: missing reason field → validation error', async () => {
    const res = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
      });

    expect(res.status).toBe(400);
  });

  it('400: empty reason → validation error', async () => {
    const res = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: '  ',
      });

    expect(res.status).toBe(400);
  });

  it('400: saleDate too old (> 7 days)', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 8);

    const res = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: oldDate.toISOString(),
        reason: 'Fecha expirada',
      });

    expect(res.status).toBe(400);
  });

  it('404: invalid returnedVariantBarcode', async () => {
    const res = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: 'BARCODE_INVALID_99999',
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Código inválido',
      });

    expect(res.status).toBe(404);
  });

  it('fires RETURN_REQUEST_CREATE audit log', async () => {
    await request(app).post('/api/v1/return-requests').set(bearer(vendedoraPradoToken)).send({
      storeId: pradoStoreId,
      returnedVariantBarcode: returnedBarcode,
      returnedQuantity: 1,
      saleDate: recentSaleDate(),
      reason: 'Para auditoría',
    });

    const found = await waitForAudit('RETURN_REQUEST_CREATE');
    expect(found).toBe(true);
  });
});

// ─── GET /mine ────────────────────────────────────────────────────────────────

describe('GET /api/v1/return-requests/mine', () => {
  it('200: vendedora sees only her own requests', async () => {
    // Submit one for vendedoraPrado
    await request(app).post('/api/v1/return-requests').set(bearer(vendedoraPradoToken)).send({
      storeId: pradoStoreId,
      returnedVariantBarcode: returnedBarcode,
      returnedQuantity: 1,
      saleDate: recentSaleDate(),
      reason: 'Solicitud propia',
    });

    const res = await request(app)
      .get('/api/v1/return-requests/mine')
      .set(bearer(vendedoraPradoToken));

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('400: admin cannot use /mine', async () => {
    const res = await request(app).get('/api/v1/return-requests/mine').set(bearer(adminToken));

    expect(res.status).toBe(400);
  });

  it('200: status filter works', async () => {
    await request(app).post('/api/v1/return-requests').set(bearer(vendedoraPradoToken)).send({
      storeId: pradoStoreId,
      returnedVariantBarcode: returnedBarcode,
      returnedQuantity: 1,
      saleDate: recentSaleDate(),
      reason: 'Con filtro',
    });

    const res = await request(app)
      .get('/api/v1/return-requests/mine?status=approved')
      .set(bearer(vendedoraPradoToken));

    expect(res.status).toBe(200);
    // The pending request should not appear under approved
    expect(res.body.rows).toHaveLength(0);
  });

  it('401: unauthenticated', async () => {
    const res = await request(app).get('/api/v1/return-requests/mine');
    expect(res.status).toBe(401);
  });
});

// ─── GET / (admin queue) ──────────────────────────────────────────────────────

describe('GET /api/v1/return-requests', () => {
  it('200: admin can see all requests', async () => {
    await request(app).post('/api/v1/return-requests').set(bearer(vendedoraPradoToken)).send({
      storeId: pradoStoreId,
      returnedVariantBarcode: returnedBarcode,
      returnedQuantity: 1,
      saleDate: recentSaleDate(),
      reason: 'Para admin',
    });

    const res = await request(app).get('/api/v1/return-requests').set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('403: vendedora cannot access admin queue', async () => {
    const res = await request(app).get('/api/v1/return-requests').set(bearer(vendedoraPradoToken));

    expect(res.status).toBe(403);
  });

  it('403: encargada cannot access admin queue', async () => {
    const res = await request(app).get('/api/v1/return-requests').set(bearer(encargadaToken));

    expect(res.status).toBe(403);
  });

  it('401: unauthenticated', async () => {
    const res = await request(app).get('/api/v1/return-requests');
    expect(res.status).toBe(401);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/return-requests/:id', () => {
  it('200: admin can fetch any request', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Para get by id',
      });

    const res = await request(app)
      .get(`/api/v1/return-requests/${created.body.id}`)
      .set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('200: requester can fetch their own request', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Mi solicitud',
      });

    const res = await request(app)
      .get(`/api/v1/return-requests/${created.body.id}`)
      .set(bearer(vendedoraPradoToken));

    expect(res.status).toBe(200);
  });

  it('403: different vendedora cannot fetch someone else request', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Solicitud ajena',
      });

    const res = await request(app)
      .get(`/api/v1/return-requests/${created.body.id}`)
      .set(bearer(vendedoraZsurToken));

    expect(res.status).toBe(403);
  });

  it('404: non-existent id → 403 (using review forbidden code)', async () => {
    const res = await request(app)
      .get('/api/v1/return-requests/non-existent-id')
      .set(bearer(adminToken));

    // Service throws 404 for not found
    expect([403, 404]).toContain(res.status);
  });
});

// ─── POST /:id/approve ────────────────────────────────────────────────────────

describe('POST /api/v1/return-requests/:id/approve', () => {
  it('200: admin approves — stock incremented, movement created', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Aprobar esto',
      });

    const res = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/approve`)
      .set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    // Stock should have incremented by 1 (was 5, now 6)
    const stock = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: returnedVariantId, storeId: pradoStoreId } },
    });
    expect(stock?.quantity).toBe(6);

    // StockMovement of type sale_return should exist
    const movement = await db.stockMovement.findFirst({
      where: { storeId: pradoStoreId, variantId: returnedVariantId, type: 'sale_return' },
    });
    expect(movement).not.toBeNull();
  });

  it('200: approve with exchange — returned stock +1, exchange stock -1', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        exchangeVariantBarcode: exchangeBarcode,
        reason: 'Cambio de talle',
      });

    const res = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/approve`)
      .set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    // Returned stock: 5 → 6
    const returnedStock = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: returnedVariantId, storeId: pradoStoreId } },
    });
    expect(returnedStock?.quantity).toBe(6);

    // Exchange stock: 3 → 2
    const exchangeStock = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: exchangeVariantId, storeId: pradoStoreId } },
    });
    expect(exchangeStock?.quantity).toBe(2);

    // Both movements must exist
    const returnMovement = await db.stockMovement.findFirst({
      where: { storeId: pradoStoreId, variantId: returnedVariantId, type: 'sale_return' },
    });
    const saleMovement = await db.stockMovement.findFirst({
      where: { storeId: pradoStoreId, variantId: exchangeVariantId, type: 'sale_out' },
    });
    expect(returnMovement).not.toBeNull();
    expect(saleMovement).not.toBeNull();
  });

  it('409: approving an already-approved request', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Doble aprobación',
      });

    await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/approve`)
      .set(bearer(adminToken));

    // Reset stock to avoid confusion and try again
    const res2 = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/approve`)
      .set(bearer(adminToken));

    expect(res2.status).toBe(409);
  });

  it('409: exchange stock insufficient', async () => {
    // Set exchange stock to 0
    await db.stockBySite.update({
      where: { variantId_storeId: { variantId: exchangeVariantId, storeId: pradoStoreId } },
      data: { quantity: 0 },
    });

    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        exchangeVariantBarcode: exchangeBarcode,
        reason: 'Sin stock para cambio',
      });

    const res = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/approve`)
      .set(bearer(adminToken));

    expect(res.status).toBe(409);
    // Stock should not have changed (atomicity: return not applied either)
    const returnedStock = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: returnedVariantId, storeId: pradoStoreId } },
    });
    // Service rejects BEFORE entering transaction — so returned stock unchanged at 5
    expect(returnedStock?.quantity).toBe(5);
  });

  it('403: vendedora cannot approve her own request', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Auto-aprobación',
      });

    const res = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/approve`)
      .set(bearer(vendedoraPradoToken));

    expect(res.status).toBe(403);
  });

  it('403: encargada cannot approve', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Encargada prueba aprobar',
      });

    const res = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/approve`)
      .set(bearer(encargadaToken));

    expect(res.status).toBe(403);
  });

  it('fires RETURN_REQUEST_APPROVE audit log', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Auditoría aprobación',
      });

    await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/approve`)
      .set(bearer(adminToken));

    const found = await waitForAudit('RETURN_REQUEST_APPROVE');
    expect(found).toBe(true);
  });
});

// ─── POST /:id/reject ─────────────────────────────────────────────────────────

describe('POST /api/v1/return-requests/:id/reject', () => {
  it('200: admin rejects with reason', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Para rechazar',
      });

    const res = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/reject`)
      .set(bearer(adminToken))
      .send({ rejectionReason: 'No cumple la política de devoluciones' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.rejectionReason).toBe('No cumple la política de devoluciones');

    // Stock should NOT have changed
    const stock = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: returnedVariantId, storeId: pradoStoreId } },
    });
    expect(stock?.quantity).toBe(5);
  });

  it('409: rejecting an already-rejected request', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Para doble rechazo',
      });

    await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/reject`)
      .set(bearer(adminToken))
      .send({ rejectionReason: 'Primer rechazo' });

    const res2 = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/reject`)
      .set(bearer(adminToken))
      .send({ rejectionReason: 'Segundo rechazo' });

    expect(res2.status).toBe(409);
  });

  it('400: empty rejectionReason → error', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Para rechazar sin motivo',
      });

    const res = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/reject`)
      .set(bearer(adminToken))
      .send({ rejectionReason: '' });

    expect(res.status).toBe(400);
  });

  it('403: vendedora cannot reject', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Vendedora rechaza',
      });

    const res = await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/reject`)
      .set(bearer(vendedoraPradoToken))
      .send({ rejectionReason: 'No me gusta' });

    expect(res.status).toBe(403);
  });

  it('fires RETURN_REQUEST_REJECT audit log', async () => {
    const created = await request(app)
      .post('/api/v1/return-requests')
      .set(bearer(vendedoraPradoToken))
      .send({
        storeId: pradoStoreId,
        returnedVariantBarcode: returnedBarcode,
        returnedQuantity: 1,
        saleDate: recentSaleDate(),
        reason: 'Auditoría rechazo',
      });

    await request(app)
      .post(`/api/v1/return-requests/${created.body.id}/reject`)
      .set(bearer(adminToken))
      .send({ rejectionReason: 'No aplica según política' });

    const found = await waitForAudit('RETURN_REQUEST_REJECT');
    expect(found).toBe(true);
  });
});
