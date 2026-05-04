// Integration: /health/live and /health/ready endpoints.
// Liveness — no DB. Readiness — SELECT 1 via Prisma.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';

const app = buildServer();

afterAll(async () => {
  await disconnectPrisma();
});

describe('GET /health/live', () => {
  it('returns 200 with status:live and uptime', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('live');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('does not require auth', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).not.toBe(401);
  });
});

describe('GET /health/ready — happy path', () => {
  it('returns 200 with status:ready, db:ok, timestamp when DB is reachable', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.db).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });
});

describe('GET /health/ready — DB down', () => {
  it('returns 503 with status:not-ready, db:down when Prisma throws', async () => {
    // Mock $queryRaw to simulate DB unreachable
    const db = getPrisma();
    const spy = jest.spyOn(db, '$queryRaw').mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not-ready');
    expect(res.body.db).toBe('down');

    spy.mockRestore();
  });
});
