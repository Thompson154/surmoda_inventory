// Integration: /api/v1/stores/:storeId/daily-reports — manual close + history.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { buildComposition } from '../../src/composition';
import { startDailyCloseJob } from '../../src/jobs/dailyClose';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';
import {
  boliviaDayKey,
  boliviaDayWindow,
  isoDateBolivia,
  previousBoliviaDayKey,
} from '../../src/modules/dailyReports/timezone';
import { resetTestState } from './_shared/dbReset';

const app = buildServer();
const db = getPrisma();

const ADMIN_EMAIL = 'admin@demo.local';
const ADMIN_PASSWORD = 'Admin1234';
const ENCARGADA_EMAIL = 'encargada.prado@demo.local';
const VENDEDORA_EMAIL = 'vendedora.prado@demo.local';
const STAFF_PASSWORD = 'Pass1234';

interface LoginResponse {
  accessToken: string;
}

async function loginToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as LoginResponse).accessToken;
}

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

let adminToken: string;
let encargadaToken: string;
let vendedoraToken: string;
let pradoStoreId: string;
let testVariantA: string;

beforeAll(async () => {
  adminToken = await loginToken(ADMIN_EMAIL, ADMIN_PASSWORD);
  encargadaToken = await loginToken(ENCARGADA_EMAIL, STAFF_PASSWORD);
  vendedoraToken = await loginToken(VENDEDORA_EMAIL, STAFF_PASSWORD);

  const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
  if (!prado) throw new Error('Seed missing PRADO');
  pradoStoreId = prado.id;

  const variant = await db.variant.findFirst({ where: { product: { code: 'JN001' } } });
  if (!variant) throw new Error('Seed missing JN001 variant');
  testVariantA = variant.id;

  await db.stockBySite.update({
    where: { variantId_storeId: { variantId: testVariantA, storeId: pradoStoreId } },
    data: { quantity: 100 },
  });
});

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

async function createSale(token: string, paymentMethod: string, qty: number) {
  return request(app)
    .post(`/api/v1/stores/${pradoStoreId}/sales`)
    .set(bearer(token))
    .send({ items: [{ variantId: testVariantA, quantity: qty }], paymentMethod });
}

const POST_CLOSE_TIME = '2026-11-21T21:00:00.000-04:00';
const PRE_CLOSE_TIME = '2026-11-21T15:00:00.000-04:00';

describe('POST /api/v1/stores/:storeId/daily-reports/close-today', () => {
  beforeEach(async () => {
    await db.dailyReport.deleteMany({ where: { storeId: pradoStoreId } });
    await db.saleItem.deleteMany({});
    await db.sale.deleteMany({});
    await db.store.update({ where: { id: pradoStoreId }, data: { salesLockedAt: null } });
  });

  it('vendedora closes the day at or after 20:45 and the report aggregates the sales', async () => {
    await createSale(vendedoraToken, 'cash', 1);
    await createSale(vendedoraToken, 'qr', 2);
    await createSale(adminToken, 'card', 1);

    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(vendedoraToken))
      .set('x-test-now', POST_CLOSE_TIME);

    expect(res.status).toBe(200);
    expect(res.body.transactionsCount).toBe(3);
    expect(res.body.itemCount).toBe(4);
    expect(res.body.cashCents).toBeGreaterThan(0);
    expect(res.body.qrCents).toBeGreaterThan(0);
    expect(res.body.cardCents).toBeGreaterThan(0);
    expect(res.body.autoClosed).toBe(false);
    expect(res.body.closedByUserId).not.toBeNull();
  });

  it('forbids staff from closing before 20:45 (422 DAILY_REPORT_TOO_EARLY)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(encargadaToken))
      .set('x-test-now', PRE_CLOSE_TIME);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('DAILY_REPORT_TOO_EARLY');
  });

  it('locks sales immediately after manual close (subsequent sales return 423 SALES_LOCKED)', async () => {
    await createSale(adminToken, 'cash', 1);
    const closeRes = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(adminToken));
    expect(closeRes.status).toBe(200);

    const saleRes = await createSale(adminToken, 'cash', 1);
    expect(saleRes.status).toBe(423);
    expect(saleRes.body.code).toBe('SALES_LOCKED');
  });

  it('is idempotent — second call refreshes the report', async () => {
    await createSale(adminToken, 'cash', 1);
    const first = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(adminToken))
      .send({ attendedNames: ['Maria'] });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(adminToken))
      .send({ attendedNames: ['Maria', 'Lucia'] });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.attendees.length).toBe(2);
  });

  // WHY: encargada can close the day for her store.
  it('encargada can close at or after 20:45 (200)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(encargadaToken))
      .set('x-test-now', POST_CLOSE_TIME);
    expect(res.status).toBe(200);
  });

  it('admin can close the day at any time', async () => {
    await createSale(adminToken, 'cash', 1);
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/stores/:storeId/daily-reports', () => {
  it('admin lists reports', async () => {
    await createSale(adminToken, 'cash', 1);
    await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(adminToken));

    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/daily-reports`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  // WHY: vendedora can read historical reports — Wave 2 RBAC opens GET to all 3 roles.
  it('vendedora can list reports (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/daily-reports`)
      .set(bearer(vendedoraToken));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/stores/:storeId/daily-reports/:date', () => {
  it('returns the report for the requested day', async () => {
    await createSale(adminToken, 'cash', 1);
    const closed = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(adminToken));

    const day = closed.body.date;
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/daily-reports/${day}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(day);
  });

  it('returns 404 for a day with no report', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/daily-reports/2020-01-01`)
      .set(bearer(adminToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DAILY_REPORT_NOT_FOUND');
  });

  it('rejects a malformed date with 400', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/daily-reports/not-a-date`)
      .set(bearer(adminToken));
    expect(res.status).toBe(400);
  });
});

describe('Daily close cron auto-close', () => {
  it('creates a report for yesterday when one is missing', async () => {
    // Seed a sale midway through yesterday (Bolivia local time).
    const now = new Date();
    const yesterdayKey = previousBoliviaDayKey(now);
    const yesterdayMidday = new Date(
      boliviaDayWindow(yesterdayKey).start.getTime() + 12 * 60 * 60 * 1000,
    );
    await db.sale.create({
      data: {
        storeId: pradoStoreId,
        recordedByUserId: (await db.user.findFirstOrThrow({ where: { email: ADMIN_EMAIL } })).id,
        paymentMethod: 'cash',
        totalCents: 12345,
        createdAt: yesterdayMidday,
        items: {
          create: [
            {
              variantId: testVariantA,
              quantity: 1,
              priceAtSaleCents: 12345,
              totalCents: 12345,
              subtotalCents: 12345,
            },
          ],
        },
      },
    });

    const composition = buildComposition();
    const job = startDailyCloseJob({
      reports: composition.dailyReportRepository,
      service: composition.dailyReportService,
    });
    job.stop(); // we only want the runOnce handle

    await job.runOnce(now);

    const created = await db.dailyReport.findUnique({
      where: { storeId_date: { storeId: pradoStoreId, date: yesterdayKey } },
    });
    expect(created).not.toBeNull();
    expect(created?.autoClosed).toBe(true);
    expect(created?.closedByUserId).toBeNull();
    expect(created?.totalCents).toBe(12345);
    expect(created!.date.toISOString().slice(0, 10)).toBe(isoDateBolivia(yesterdayMidday));
    expect(boliviaDayKey(yesterdayMidday).getTime()).toBe(yesterdayKey.getTime());
  });
});
