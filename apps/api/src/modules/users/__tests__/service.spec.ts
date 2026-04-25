import bcrypt from 'bcrypt';
import { buildUserService, type UserService } from '../service';
import type { UserRepository } from '../repository';
import { AppError } from '../../../shared/errors/AppError';

interface MockRepo {
  findById: jest.Mock;
  findByEmail: jest.Mock;
  create: jest.Mock;
  list: jest.Mock;
}

let users: MockRepo;
let service: UserService;

beforeEach(() => {
  users = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
  };
  service = buildUserService({ users: users as unknown as UserRepository });
});

const buildCreated = () => ({
  id: 'u1',
  email: 'new@test.local',
  fullName: 'New User',
  isAdmin: false,
  isActive: true,
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

  it('rejects with USER_CREATE_DUPLICATE_EMAIL on Prisma P2002 race', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockRejectedValue(
      Object.assign(new Error('unique violation'), {
        code: 'P2002',
        clientVersion: '5.22.0',
        meta: { target: ['email'] },
        // mark prototype so `instanceof Prisma.PrismaClientKnownRequestError` works in service
        name: 'PrismaClientKnownRequestError',
      }),
    );
    // Force the prototype check
    Object.setPrototypeOf(users.create.mock.results[0]?.value ?? {}, Error.prototype);

    await expect(
      service.create({
        email: 'dup@test.local',
        password: 'Secret1234',
        fullName: 'Dup',
        isAdmin: false,
        assignments: [{ storeId: 's1', role: 'vendedora' }],
      }),
    ).rejects.toBeInstanceOf(Error);
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

    const persisted = users.create.mock.calls[0]?.[0] as { isAdmin: boolean; assignments: unknown[] };
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
