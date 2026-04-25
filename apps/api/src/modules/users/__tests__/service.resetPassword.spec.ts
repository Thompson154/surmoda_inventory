import bcrypt from 'bcrypt';
import { buildUserService, type UserService } from '../service';
import type { UserRepository } from '../repository';
import type { RefreshTokenRepository } from '../../auth/repository';

interface MockUsersRepo {
  findById: jest.Mock;
  findByEmail: jest.Mock;
  create: jest.Mock;
  list: jest.Mock;
  update: jest.Mock;
  setActive: jest.Mock;
  setPasswordHash: jest.Mock;
  countActiveAdmins: jest.Mock;
  isAdminById: jest.Mock;
}

interface MockRefreshRepo {
  create: jest.Mock;
  findActiveByHash: jest.Mock;
  findAnyByHash: jest.Mock;
  rotate: jest.Mock;
  revokeFamily: jest.Mock;
  revokeAllForUser: jest.Mock;
  revokeOne: jest.Mock;
}

let users: MockUsersRepo;
let refreshTokens: MockRefreshRepo;
let service: UserService;

const existingUser = () => ({
  id: 'u1',
  email: 'staff@test.local',
  fullName: 'Staff',
  isAdmin: false,
  isActive: true,
  assignments: [{ id: 'a1', storeId: 's1', role: 'vendedora' as const }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  users = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    setPasswordHash: jest.fn(),
    countActiveAdmins: jest.fn(),
    isAdminById: jest.fn(),
  };
  refreshTokens = {
    create: jest.fn(),
    findActiveByHash: jest.fn(),
    findAnyByHash: jest.fn(),
    rotate: jest.fn(),
    revokeFamily: jest.fn().mockResolvedValue(0),
    revokeAllForUser: jest.fn().mockResolvedValue(0),
    revokeOne: jest.fn(),
  };
  service = buildUserService({
    users: users as unknown as UserRepository,
    refreshTokens: refreshTokens as unknown as RefreshTokenRepository,
  });
});

describe('UserService.adminResetPassword', () => {
  it('hashes the new password and persists via repository', async () => {
    users.findById.mockResolvedValue(existingUser());

    await service.adminResetPassword('u1', { newPassword: 'NewPass1234' });

    expect(users.setPasswordHash).toHaveBeenCalledTimes(1);
    const [calledId, persistedHash] = users.setPasswordHash.mock.calls[0] as [string, string];
    expect(calledId).toBe('u1');
    expect(persistedHash).not.toBe('NewPass1234');
    const matches = await bcrypt.compare('NewPass1234', persistedHash);
    expect(matches).toBe(true);
  });

  it('revokes ALL refresh tokens for the user (every device must re-login)', async () => {
    users.findById.mockResolvedValue(existingUser());

    await service.adminResetPassword('u1', { newPassword: 'NewPass1234' });

    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('throws USER_NOT_FOUND when user does not exist', async () => {
    users.findById.mockResolvedValue(null);
    await expect(
      service.adminResetPassword('missing', { newPassword: 'NewPass1234' }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
    expect(users.setPasswordHash).not.toHaveBeenCalled();
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });
});
