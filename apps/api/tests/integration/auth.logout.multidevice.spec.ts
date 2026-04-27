// T091 — Integration: logout on device A keeps device B working
// WHY: per-session revocation — only the specific refresh token is revoked,
//      not all tokens for the user.

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildServer } from '../../src/server';
import { getPrisma, disconnectPrisma } from '../../src/infrastructure/database';

const app = buildServer();
const db = getPrisma();

afterAll(async () => {
  await db.refreshToken.deleteMany({});
  await db.user.deleteMany({ where: { email: { contains: 'logout-t091' } } });
  await disconnectPrisma();
});

describe('Logout: per-session revocation (multi-device)', () => {
  it('logout on device A does not affect device B session', async () => {
    const passwordHash = await bcrypt.hash('MultiDevice1', 4);
    const user = await db.user.create({
      data: {
        email: `logout-t091-${Date.now()}@test.local`,
        passwordHash,
        fullName: 'Multi Device User',
        isAdmin: false,
      },
    });

    // Device A logs in
    const loginA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'MultiDevice1' });
    const cookieA = loginA.headers['set-cookie'] as unknown as string[];
    const accessTokenA = (loginA.body as { accessToken: string }).accessToken;

    // Device B logs in (separate session, separate refresh token)
    const loginB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'MultiDevice1' });
    const cookieB = loginB.headers['set-cookie'] as unknown as string[];
    const accessTokenB = (loginB.body as { accessToken: string }).accessToken;

    expect(accessTokenA).toBeTruthy();
    expect(accessTokenB).toBeTruthy();

    // Device A logs out
    const logoutRes = await request(app).post('/api/v1/auth/logout').set('Cookie', cookieA);
    expect(logoutRes.status).toBe(204);

    // Device A's refresh token is now revoked → refresh fails
    const refreshA = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieA);
    expect(refreshA.status).not.toBe(200);

    // Device B's refresh token is still valid → refresh succeeds
    const refreshB = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieB);
    expect(refreshB.status).toBe(200);
    expect((refreshB.body as { accessToken?: string }).accessToken).toBeTruthy();
  });
});
