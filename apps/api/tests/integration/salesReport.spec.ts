// Integration: POST /api/v1/reports/sales
// Sales report endpoint — preview (JSON) and xlsx (stream).

import { Readable } from 'stream';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';
import { resetTestState } from './_shared/dbReset';
import { loginAs, bearer } from './_shared/fixtures';

const app = buildServer();
const db = getPrisma();

let adminToken: string;
let encargadaPradoToken: string;
let vendedoraPradoToken: string;
let pradoStoreId: string;
let zsurStoreId: string;

// ─── Dates for the test window ────────────────────────────────────────────────

const FROM = new Date('2026-01-01T00:00:00.000Z').toISOString();
const TO = new Date('2026-01-31T23:59:59.000Z').toISOString();

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });

  adminToken = await loginAs(app, 'admin');
  encargadaPradoToken = await loginAs(app, 'encargadaPrado');
  vendedoraPradoToken = await loginAs(app, 'vendedoraPrado');
  const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
  const zsur = await db.store.findFirst({ where: { code: 'ZSUR' } });
  if (!prado || !zsur) throw new Error('Seed missing PRADO or ZSUR store');
  pradoStoreId = prado.id;
  zsurStoreId = zsur.id;

  // Seed a variant with stock in PRADO for the test sales
  const variant = await db.variant.findFirst({
    where: { deletedAt: null, isActive: true },
    include: { product: true },
  });
  if (!variant) throw new Error('Seed missing at least one active variant');

  // Set PRADO stock to 20 so sales don't fail on negative stock
  await db.stockBySite.upsert({
    where: { variantId_storeId: { variantId: variant.id, storeId: pradoStoreId } },
    update: { quantity: 20 },
    create: { variantId: variant.id, storeId: pradoStoreId, quantity: 20 },
  });

  // Seed vendedora user in PRADO store for cashier resolution
  const vendedoraUser = await db.user.findFirst({ where: { email: 'vendedora.prado@demo.local' } });
  if (!vendedoraUser) throw new Error('Seed missing vendedora.prado@demo.local');

  // Create 3 sales in the window
  for (let i = 0; i < 3; i++) {
    await db.sale.create({
      data: {
        storeId: pradoStoreId,
        recordedByUserId: vendedoraUser.id,
        paymentMethod: 'cash',
        totalCents: 10000 * (i + 1),
        createdAt: new Date(`2026-01-${(i + 10).toString().padStart(2, '0')}T14:00:00.000Z`),
        items: {
          create: {
            variantId: variant.id,
            quantity: i + 1,
            priceAtSaleCents: 10000,
            totalCents: 10000 * (i + 1),
            subtotalCents: 10000 * (i + 1),
          },
        },
      },
    });
  }

  // Create 2 sales outside the window (should NOT appear)
  await db.sale.create({
    data: {
      storeId: pradoStoreId,
      recordedByUserId: vendedoraUser.id,
      paymentMethod: 'card',
      totalCents: 5000,
      createdAt: new Date('2025-12-01T10:00:00.000Z'),
      items: {
        create: {
          variantId: variant.id,
          quantity: 1,
          priceAtSaleCents: 5000,
          totalCents: 5000,
          subtotalCents: 5000,
        },
      },
    },
  });
});

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/reports/sales — auth', () => {
  it('returns 401 when no auth token provided', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .send({ storeId: pradoStoreId, from: FROM, to: TO, format: 'preview' });
    expect(res.status).toBe(401);
  });
});

// ─── RBAC ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/reports/sales — RBAC', () => {
  it('admin can generate report for any storeId', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, from: FROM, to: TO, format: 'preview' });
    expect(res.status).toBe(200);
  });

  it('encargada can generate report for any storeId (global scope)', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(encargadaPradoToken))
      .send({ storeId: zsurStoreId, from: FROM, to: TO, format: 'preview' });
    expect(res.status).toBe(200);
  });

  it('vendedora can generate report for her own storeId', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(vendedoraPradoToken))
      .send({ storeId: pradoStoreId, from: FROM, to: TO, format: 'preview' });
    expect(res.status).toBe(200);
  });

  it('vendedora gets 403 for a storeId that is not hers', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(vendedoraPradoToken))
      .send({ storeId: zsurStoreId, from: FROM, to: TO, format: 'preview' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('REPORT_STORE_FORBIDDEN');
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe('POST /api/v1/reports/sales — validation', () => {
  it('rejects missing storeId with 400', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({ from: FROM, to: TO });
    expect(res.status).toBe(400);
  });

  it('rejects to <= from with 400', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, from: TO, to: FROM });
    expect(res.status).toBe(400);
  });

  it('rejects range > 12 months with 400 and descriptive message', async () => {
    const farFuture = new Date('2027-12-31T23:59:59.000Z').toISOString();
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, from: FROM, to: farFuture });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/12/);
  });
});

// ─── Preview response ─────────────────────────────────────────────────────────

describe('POST /api/v1/reports/sales — preview format', () => {
  it('returns JSON with store, period, sales sections', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, from: FROM, to: TO, format: 'preview' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);

    const body = res.body as Record<string, unknown>;
    expect(body).toHaveProperty('store');
    expect(body).toHaveProperty('period');
    expect(body).toHaveProperty('sales');
    expect(body).toHaveProperty('generatedAt');

    const store = body.store as Record<string, unknown>;
    expect(store).toHaveProperty('id', pradoStoreId);
    expect(store).toHaveProperty('name');
    expect(store).toHaveProperty('code');

    const sales = body.sales as Record<string, unknown>;
    expect(Array.isArray(sales.rows)).toBe(true);
    expect(typeof sales.totalRows).toBe('number');
    expect(typeof sales.totalAmountCents).toBe('number');
    // We seeded 3 sales in the window
    expect(sales.totalRows).toBe(3);
  });

  it('paymentSummary is absent by default', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, from: FROM, to: TO, format: 'preview' });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('paymentSummary');
  });

  it('paymentSummary is present when includePaymentSummary=true', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({
        storeId: pradoStoreId,
        from: FROM,
        to: TO,
        format: 'preview',
        includePaymentSummary: true,
      });

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body).toHaveProperty('paymentSummary');
    const ps = body.paymentSummary as Record<string, unknown>;
    expect(typeof ps.cash).toBe('number');
    expect(typeof ps.card).toBe('number');
    expect(typeof ps.qr).toBe('number');
    expect(typeof ps.total).toBe('number');
  });

  it('inventory section is present when includeInventory=true', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({
        storeId: pradoStoreId,
        from: FROM,
        to: TO,
        format: 'preview',
        includeInventory: true,
      });

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body).toHaveProperty('inventory');
    const inv = body.inventory as Record<string, unknown>;
    expect(Array.isArray(inv.rows)).toBe(true);
    expect(typeof inv.totalVariants).toBe('number');
    expect(typeof inv.totalUnits).toBe('number');
    expect(typeof inv.capturedAt).toBe('string');
  });

  it('sales rows have the expected SalesRow shape', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, from: FROM, to: TO, format: 'preview' });

    expect(res.status).toBe(200);
    const sales = (res.body.sales as { rows: Record<string, unknown>[] }).rows;
    if (sales.length > 0) {
      const row = sales[0];
      expect(row).toHaveProperty('saleDate');
      expect(row).toHaveProperty('saleTime');
      expect(row).toHaveProperty('ticketNumber');
      expect(row).toHaveProperty('productCode');
      expect(row).toHaveProperty('variantDescription');
      expect(row).toHaveProperty('color');
      expect(row).toHaveProperty('size');
      expect(row).toHaveProperty('quantity');
      expect(row).toHaveProperty('unitPriceCents');
      expect(row).toHaveProperty('subtotalCents');
      expect(row).toHaveProperty('paymentMethod');
      expect(row).toHaveProperty('cashier');
    }
  });
});

// ─── XLSX format ──────────────────────────────────────────────────────────────

describe('POST /api/v1/reports/sales — xlsx format', () => {
  it('returns binary xlsx with correct Content-Type', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, from: FROM, to: TO, format: 'xlsx' })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
  });

  it('Content-Disposition header has the correct filename pattern', async () => {
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({ storeId: pradoStoreId, from: FROM, to: TO, format: 'xlsx' })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    const disposition = res.headers['content-disposition'] as string;
    expect(disposition).toMatch(/attachment/);
    expect(disposition).toMatch(/reporte-ventas/);
    expect(disposition).toMatch(/PRADO/);
    expect(disposition).toMatch(/\.xlsx/);
  });

  it('xlsx price columns contain Bs values (divided by 100) with correct numFmt', async () => {
    // We seeded 3 sales with priceAtSaleCents=10000 → Bs 100.00
    const res = await request(app)
      .post('/api/v1/reports/sales')
      .set(bearer(adminToken))
      .send({
        storeId: pradoStoreId,
        from: FROM,
        to: TO,
        format: 'xlsx',
        includePaymentSummary: true,
      })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);

    // Parse the Excel buffer with ExcelJS
    const wb = new ExcelJS.Workbook();
    const readable = Readable.from(res.body as Buffer);
    await wb.xlsx.read(readable);

    const salesSheet = wb.getWorksheet('Ventas');
    expect(salesSheet).toBeDefined();

    // Find the first data row (row 6 onwards: 4 header rows + 1 column header row)
    // Look for a row that has a numeric value in the price column (col 9)
    let foundPriceRow = false;
    salesSheet!.eachRow((row, rowNumber) => {
      if (rowNumber < 6) return; // skip meta + column headers
      const priceCell = row.getCell(9); // Precio Unitario
      const subtotalCell = row.getCell(10); // Subtotal
      if (typeof priceCell.value === 'number' && priceCell.value > 0) {
        foundPriceRow = true;
        // Value must be in Bs (divided by 100). Our seeded price is 10000 cents = 100.00 Bs
        expect(priceCell.value).toBe(100);
        // numFmt must contain 'Bs'
        expect(priceCell.numFmt ?? '').toMatch(/Bs/);
        expect(subtotalCell.numFmt ?? '').toMatch(/Bs/);
      }
    });
    expect(foundPriceRow).toBe(true);

    // Verify payment summary sheet totals are also in Bs
    const pmSheet = wb.getWorksheet('Resumen de pagos');
    expect(pmSheet).toBeDefined();
    let foundPmRow = false;
    pmSheet!.eachRow((row, rowNumber) => {
      if (rowNumber < 2) return;
      const totalCell = row.getCell(2);
      if (typeof totalCell.value === 'number' && totalCell.value > 0) {
        foundPmRow = true;
        // All amounts should be < 10000 (centavos would be >= 10000 for our seed data)
        // Seeded total: 10000+20000+30000 = 60000 cents → 600 Bs
        expect(totalCell.value).toBeLessThan(10000);
        expect(totalCell.numFmt ?? '').toMatch(/Bs/);
      }
    });
    expect(foundPmRow).toBe(true);
  });
});
