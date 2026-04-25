import bcrypt from 'bcrypt';
import { buildAuthService, type AuthService } from '../service';
import {
  InvalidCredentialsError,
  RefreshTokenExpiredError,
  RefreshTokenNotFoundError,
  TokenReplayError,
  UserInactiveError,
} from '../../../shared/errors/authErrors';
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

const buildUser = (overrides: Partial<{ isActive: boolean; isAdmin: boolean }> = {}) => ({
  id: 'u1',
  email: 'user@test.local',
  fullName: 'Test User',
  isAdmin: false,
  isActive: true,
  passwordHash: '',
  assignments: [{ storeId: 's1', role: 'vendedora' as const }],
  ...overrides,
});

describe('AuthService.login', () => {
  it('returns access + refresh on valid credentials', async () => {
    const passwordHash = await bcrypt.hash('Secret123', 4);
    db.user.findUnique.mockResolvedValue({ ...buildUser(), passwordHash });

    const result = await service.login({ email: 'user@test.local', password: 'Secret123' });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken.plaintext).toEqual(expect.any(String));
    expect(result.user.email).toBe('user@test.local');
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('throws InvalidCredentialsError when user not found', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@test.local', password: 'x' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('throws InvalidCredentialsError when password mismatches', async () => {
    const passwordHash = await bcrypt.hash('CorrectPass', 4);
    db.user.findUnique.mockResolvedValue({ ...buildUser(), passwordHash });
    await expect(
      service.login({ email: 'user@test.local', password: 'WrongPass' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws UserInactiveError when account is deactivated', async () => {
    const passwordHash = await bcrypt.hash('Secret123', 4);
    db.user.findUnique.mockResolvedValue({ ...buildUser({ isActive: false }), passwordHash });
    await expect(
      service.login({ email: 'user@test.local', password: 'Secret123' }),
    ).rejects.toBeInstanceOf(UserInactiveError);
  });
});

describe('AuthService.refresh', () => {
  const validRefresh = 'a'.repeat(128);

  it('rotates the refresh token and issues a new access token', async () => {
    const tokenHash = hashRefreshToken(validRefresh);
    repo.findAnyByHash.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      tokenHash,
      parentTokenId: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
      createdAt: new Date(),
    });
    db.user.findUnique.mockResolvedValue(buildUser());

    const result = await service.refresh(validRefresh);

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken.plaintext).not.toBe(validRefresh);
    expect(repo.rotate).toHaveBeenCalledTimes(1);
  });

  it('detects replay (revoked token presented again) and revokes the family', async () => {
    repo.findAnyByHash.mockResolvedValue({
      id: 'rt-replay',
      userId: 'u1',
      tokenHash: 'h',
      parentTokenId: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
    });

    await expect(service.refresh(validRefresh)).rejects.toBeInstanceOf(TokenReplayError);
    expect(repo.revokeFamily).toHaveBeenCalledWith('rt-replay');
  });

  it('throws RefreshTokenNotFoundError when token unknown', async () => {
    repo.findAnyByHash.mockResolvedValue(null);
    await expect(service.refresh(validRefresh)).rejects.toBeInstanceOf(RefreshTokenNotFoundError);
  });

  it('throws RefreshTokenExpiredError when token past expiry', async () => {
    repo.findAnyByHash.mockResolvedValue({
      id: 'rt-old',
      userId: 'u1',
      tokenHash: 'h',
      parentTokenId: null,
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      createdAt: new Date(),
    });
    await expect(service.refresh(validRefresh)).rejects.toBeInstanceOf(RefreshTokenExpiredError);
  });

  it('throws UserInactiveError when owner has been deactivated', async () => {
    repo.findAnyByHash.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      tokenHash: 'h',
      parentTokenId: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
    });
    db.user.findUnique.mockResolvedValue(buildUser({ isActive: false }));
    await expect(service.refresh(validRefresh)).rejects.toBeInstanceOf(UserInactiveError);
  });
});

describe('AuthService.logout', () => {
  it('revokes the active refresh token', async () => {
    repo.findAnyByHash.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      tokenHash: 'h',
      parentTokenId: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
    });
    await service.logout('plain');
    expect(repo.revokeOne).toHaveBeenCalledWith('rt1');
  });

  it('is idempotent when token not present', async () => {
    repo.findAnyByHash.mockResolvedValue(null);
    await expect(service.logout('plain')).resolves.toBeUndefined();
    expect(repo.revokeOne).not.toHaveBeenCalled();
  });

  it('does not revoke a token that is already revoked (no-op)', async () => {
    repo.findAnyByHash.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      tokenHash: 'h',
      parentTokenId: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      createdAt: new Date(),
    });
    await service.logout('plain');
    expect(repo.revokeOne).not.toHaveBeenCalled();
  });
});

describe('AuthService.me', () => {
  it('returns the user DTO with assignments', async () => {
    db.user.findUnique.mockResolvedValue(buildUser());
    const result = await service.me('u1');
    expect(result.id).toBe('u1');
    expect(result.assignments).toEqual([{ storeId: 's1', role: 'vendedora' }]);
  });

  it('throws when user not found', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.me('missing')).rejects.toBeInstanceOf(RefreshTokenNotFoundError);
  });

  it('throws UserInactiveError when user is deactivated', async () => {
    db.user.findUnique.mockResolvedValue(buildUser({ isActive: false }));
    await expect(service.me('u1')).rejects.toBeInstanceOf(UserInactiveError);
  });
});
