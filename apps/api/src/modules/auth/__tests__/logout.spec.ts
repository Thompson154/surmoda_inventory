// T089 — AuthService.logout unit tests (Strict TDD)
// WHY: logout must revoke only the calling device's refresh token, be idempotent,
//      and the controller must emit AUTH_LOGOUT audit event.

import { buildAuthService, type AuthService } from '../service';
import { hashRefreshToken } from '../../../infrastructure/jwt';

interface MockDb {
  user: { findUnique: jest.Mock };
}

interface MockRepo {
  create: jest.Mock;
  findActiveByHash: jest.Mock;
  findAnyByHash: jest.Mock;
  rotate: jest.Mock;
  revokeFamily: jest.Mock;
  revokeAllForUser: jest.Mock;
  revokeOne: jest.Mock;
}

let db: MockDb;
let repo: MockRepo;
let service: AuthService;

beforeEach(() => {
  db = { user: { findUnique: jest.fn() } };
  repo = {
    create: jest.fn().mockResolvedValue({}),
    findActiveByHash: jest.fn(),
    findAnyByHash: jest.fn(),
    rotate: jest.fn().mockResolvedValue({}),
    revokeFamily: jest.fn().mockResolvedValue(0),
    revokeAllForUser: jest.fn().mockResolvedValue(0),
    revokeOne: jest.fn().mockResolvedValue(undefined),
  };
  service = buildAuthService({ db: db as never, refreshTokens: repo });
});

const activeToken = (id = 'rt1') => ({
  id,
  userId: 'u1',
  tokenHash: hashRefreshToken('plain-token'),
  parentTokenId: null,
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  createdAt: new Date(),
});

describe('AuthService.logout', () => {
  it('revokes ONLY the calling device refresh token (single revokeOne call)', async () => {
    repo.findAnyByHash.mockResolvedValue(activeToken());

    await service.logout('plain-token');

    expect(repo.revokeOne).toHaveBeenCalledTimes(1);
    expect(repo.revokeOne).toHaveBeenCalledWith('rt1');
    // Must NOT revoke the whole family — other devices unaffected
    expect(repo.revokeFamily).not.toHaveBeenCalled();
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('is idempotent when the cookie refresh token is not in the DB', async () => {
    repo.findAnyByHash.mockResolvedValue(null);

    await expect(service.logout('unknown-token')).resolves.toBeUndefined();
    expect(repo.revokeOne).not.toHaveBeenCalled();
  });

  it('is idempotent when the refresh token is already revoked', async () => {
    repo.findAnyByHash.mockResolvedValue({
      ...activeToken(),
      revokedAt: new Date(Date.now() - 1000),
    });

    await expect(service.logout('plain-token')).resolves.toBeUndefined();
    expect(repo.revokeOne).not.toHaveBeenCalled();
  });

  it('does NOT throw when plaintext is empty string (no-cookie scenario)', async () => {
    repo.findAnyByHash.mockResolvedValue(null);
    await expect(service.logout('')).resolves.toBeUndefined();
  });
});
