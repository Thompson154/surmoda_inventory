// Integration: Helmet hardening on every response.
// We hit a public health endpoint so the assertions don't depend on auth.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma } from '../../src/infrastructure/database';

const app = buildServer();

afterAll(async () => {
  await disconnectPrisma();
});

describe('Helmet — production-grade HTTP hardening', () => {
  it('emits a strict Content-Security-Policy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('blocks framing via X-Frame-Options: DENY', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('sets Referrer-Policy: no-referrer', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('strips X-Powered-By', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
