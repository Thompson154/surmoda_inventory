// Integration: /api/v1/reports/summary — admin/encargada cross-store analytics.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';
import { resetTestState } from './_shared/dbReset';
import { isoDateBolivia } from '../../src/shared/datetime/bolivia';

const app = buildServer();
const db = getPrisma();

const ADMIN_EMAIL = 'admin@demo.local';
const ADMIN_PASSWORD = 'Admin1234';
const ENCARGADA_EMAIL = 'encargada.prado@demo.local';
const VENDEDORA_EMAIL = 'vendedora.prado@demo.local';
const STAFF_PASSWORD = 'Pass1234';

interface LoginResponse { accessToken: string }

async function loginToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status}`);
  return (res.body as LoginResponse).accessToken;
}

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

let adminToken: string;
let encargadaToken: string;
let vendedoraToken: string;

beforeAll(async () => {
  adminToken = await loginToken(ADMIN_EMAIL, ADMIN_PASSWORD);
  encargadaToken = await loginToken(ENCARGADA_EMAIL, STAFF_PASSWORD);
  vendedoraToken = await loginToken(VENDEDORA_EMAIL, STAFF_PASSWORD);
});

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

describe('GET /api/v1/reports/summary', () => {
  const today = isoDateBolivia(new Date());
  const sevenDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return isoDateBolivia(d);
  })();

  it('admin sees summary with all sections', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/summary?from=${sevenDaysAgo}&to=${today}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('range');
    expect(res.body.range.from).toBe(sevenDaysAgo);
    expect(res.body.range.to).toBe(today);
    expect(res.body).toHaveProperty('totals');
    expect(res.body.totals).toHaveProperty('totalCents');
    expect(res.body.totals).toHaveProperty('averageTicketCents');
    expect(res.body.totals).toHaveProperty('discountCents');
    expect(Array.isArray(res.body.byStore)).toBe(true);
    expect(Array.isArray(res.body.topProducts)).toBe(true);
    expect(Array.isArray(res.body.topSellers)).toBe(true);
  });

  it('encargada (global) is allowed', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/summary?from=${today}&to=${today}`)
      .set(bearer(encargadaToken));
    expect(res.status).toBe(200);
  });

  it('vendedora is blocked (403 STORE_FORBIDDEN)', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/summary?from=${today}&to=${today}`)
      .set(bearer(vendedoraToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STORE_FORBIDDEN');
  });

  it('rejects malformed dates with 400', async () => {
    const res = await request(app)
      .get('/api/v1/reports/summary?from=not-a-date&to=2026-04-30')
      .set(bearer(adminToken));
    expect(res.status).toBe(400);
  });

  it('rejects from > to with 400', async () => {
    const res = await request(app)
      .get('/api/v1/reports/summary?from=2026-04-30&to=2026-04-01')
      .set(bearer(adminToken));
    expect(res.status).toBe(400);
  });

  it('top products limited to 10, top sellers to 5', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/summary?from=${sevenDaysAgo}&to=${today}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.topProducts.length).toBeLessThanOrEqual(10);
    expect(res.body.topSellers.length).toBeLessThanOrEqual(5);
  });
});
