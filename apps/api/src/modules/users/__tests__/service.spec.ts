import bcrypt from 'bcryptjs';
import { buildUserService, type UserService } from '../service';
import type { UserRepository } from '../repository';
import type { RefreshTokenRepository } from '../../auth/repository';
import { AppError } from '../../../shared/errors/AppError';

interface MockUsersRepo {
  findById: jest.Mock;
  findByEmail: jest.Mock;
  create: jest.Mock;
  list: jest.Mock;
  update: jest.Mock;
  setActive: jest.Mock;
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

beforeEach(() => {
  users = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
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

const buildCreated = (
  overrides: Partial<{ id: string; isAdmin: boolean; isActive: boolean }> = {},
) => ({
  id: overrides.id ?? 'u1',
  email: 'new@test.local',
  fullName: 'New User',
  isAdmin: overrides.isAdmin ?? false,
  isActive: overrides.isActive ?? true,
  assignments: [{ id: 'a1', storeId: 's1', role: 'vendedora' as const }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('UserService.create', () => {
  it('hashes the password and persists the user via the repository', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(buildCreated());

    const result = await service.create({
      email: 'NEW@TEST.LOCAL',
      password: 'Secret1234',
      fullName: 'New User',
      isAdmin: false,
      assignments: [{ storeId: 's1', role: 'vendedora' }],
    });

    expect(users.create).toHaveBeenCalledTimes(1);
    const persistInput = users.create.mock.calls[0]?.[0] as { passwordHash: string };
    expect(persistInput.passwordHash).not.toBe('Secret1234');
    const matches = await bcrypt.compare('Secret1234', persistInput.passwordHash);
    expect(matches).toBe(true);
    expect(result.email).toBe('new@test.local');
  });

  it('rejects with USER_CREATE_DUPLICATE_EMAIL when email exists in pre-check', async () => {
    users.findByEmail.mockResolvedValue({ id: 'existing', email: 'dup@test.local' });
    await expect(
      service.create({
        email: 'dup@test.local',
        password: 'Secret1234',
        fullName: 'Dup',
        isAdmin: false,
        assignments: [{ storeId: 's1', role: 'vendedora' }],
      }),
    ).rejects.toMatchObject({ code: 'USER_CREATE_DUPLICATE_EMAIL', statusCode: 409 });
    expect(users.create).not.toHaveBeenCalled();
  });

  it('forwards admin payload (no assignments) to the repository when isAdmin=true', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ ...buildCreated(), isAdmin: true, assignments: [] });

    await service.create({
      email: 'admin2@test.local',
      password: 'Secret1234',
      fullName: 'Admin 2',
      isAdmin: true,
    });

    const persisted = users.create.mock.calls[0]?.[0] as {
      isAdmin: boolean;
      assignments: unknown[];
    };
    expect(persisted.isAdmin).toBe(true);
    expect(persisted.assignments).toEqual([]);
  });
});

describe('UserService.list', () => {
  it('passes the paginated query through to the repository', async () => {
    users.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await service.list({ page: 2, pageSize: 50, q: 'admin' });

    expect(users.list).toHaveBeenCalledWith({ page: 2, pageSize: 50, q: 'admin' });
  });
});

describe('UserService.getById', () => {
  it('returns the user when found', async () => {
    users.findById.mockResolvedValue(buildCreated());
    const result = await service.getById('u1');
    expect(result.id).toBe('u1');
  });

  it('throws USER_NOT_FOUND with 404 when missing', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(AppError);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('UserService.update', () => {
  it('updates fullName when provided', async () => {
    users.findById.mockResolvedValue(buildCreated());
    users.update.mockResolvedValue({ ...buildCreated(), fullName: 'New Name' });

    const result = await service.update('u1', { fullName: 'New Name' });

    expect(users.update).toHaveBeenCalledWith('u1', { fullName: 'New Name' });
    expect(result.fullName).toBe('New Name');
  });

  it('throws USER_NOT_FOUND for missing user', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.update('missing', { fullName: 'X' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
    expect(users.update).not.toHaveBeenCalled();
  });

  it('blocks demoting the LAST active admin (USER_DEACTIVATE_LAST_ADMIN)', async () => {
    users.findById.mockResolvedValue(buildCreated({ isAdmin: true }));
    users.isAdminById.mockResolvedValue(true);
    users.countActiveAdmins.mockResolvedValue(1);

    await expect(service.update('u1', { isAdmin: false })).rejects.toMatchObject({
      code: 'USER_DEACTIVATE_LAST_ADMIN',
      statusCode: 409,
    });
    expect(users.update).not.toHaveBeenCalled();
  });

  it('allows demoting an admin when others remain', async () => {
    users.findById.mockResolvedValue(buildCreated({ isAdmin: true }));
    users.isAdminById.mockResolvedValue(true);
    users.countActiveAdmins.mockResolvedValue(2);
    users.update.mockResolvedValue({ ...buildCreated(), isAdmin: false });

    await service.update('u1', { isAdmin: false });

    expect(users.update).toHaveBeenCalledWith('u1', { isAdmin: false });
  });
});

describe('UserService.deactivate', () => {
  it('sets isActive=false and revokes ALL refresh tokens', async () => {
    users.findById.mockResolvedValue(buildCreated({ isAdmin: false, isActive: true }));
    users.setActive.mockResolvedValue(buildCreated({ isAdmin: false, isActive: false }));

    const result = await service.deactivate('u1');

    expect(users.setActive).toHaveBeenCalledWith('u1', false);
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(result.isActive).toBe(false);
  });

  it('is idempotent: returns the user without DB writes if already inactive', async () => {
    users.findById.mockResolvedValue(buildCreated({ isActive: false }));

    await service.deactivate('u1');

    expect(users.setActive).not.toHaveBeenCalled();
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('blocks deactivating the LAST active admin', async () => {
    users.findById.mockResolvedValue(buildCreated({ isAdmin: true, isActive: true }));
    users.isAdminById.mockResolvedValue(true);
    users.countActiveAdmins.mockResolvedValue(1);

    await expect(service.deactivate('u1')).rejects.toMatchObject({
      code: 'USER_DEACTIVATE_LAST_ADMIN',
      statusCode: 409,
    });
    expect(users.setActive).not.toHaveBeenCalled();
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('throws USER_NOT_FOUND when user does not exist', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.deactivate('missing')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('UserService.reactivate', () => {
  it('sets isActive=true', async () => {
    users.findById.mockResolvedValue(buildCreated({ isActive: false }));
    users.setActive.mockResolvedValue(buildCreated({ isActive: true }));

    const result = await service.reactivate('u1');

    expect(users.setActive).toHaveBeenCalledWith('u1', true);
    expect(result.isActive).toBe(true);
  });

  it('is idempotent when already active', async () => {
    users.findById.mockResolvedValue(buildCreated({ isActive: true }));
    await service.reactivate('u1');
    expect(users.setActive).not.toHaveBeenCalled();
  });
});
