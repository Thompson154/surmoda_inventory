import { buildAssignmentService, type AssignmentService } from '../service';
import type { UserStoreRepository } from '../repository';
import type { UserRepository } from '../../users/repository';

interface MockAssignmentsRepo {
  listActiveByUser: jest.Mock;
  countActiveByUser: jest.Mock;
  findById: jest.Mock;
  findActiveByUserStore: jest.Mock;
  create: jest.Mock;
  updateRole: jest.Mock;
  softDelete: jest.Mock;
}

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

let assignments: MockAssignmentsRepo;
let users: MockUsersRepo;
let service: AssignmentService;

beforeEach(() => {
  assignments = {
    listActiveByUser: jest.fn(),
    countActiveByUser: jest.fn(),
    findById: jest.fn(),
    findActiveByUserStore: jest.fn(),
    create: jest.fn(),
    updateRole: jest.fn(),
    softDelete: jest.fn(),
  };
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
  service = buildAssignmentService({
    assignments: assignments as unknown as UserStoreRepository,
    users: users as unknown as UserRepository,
  });
});

const staffUser = (id = 'u1') => ({
  id,
  email: 'staff@test.local',
  fullName: 'Staff',
  isAdmin: false,
  isActive: true,
  assignments: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const adminUser = (id = 'admin1') => ({ ...staffUser(id), isAdmin: true });

const assignmentRow = (overrides: Partial<{ id: string; userId: string; storeId: string }> = {}) => ({
  id: overrides.id ?? 'a1',
  userId: overrides.userId ?? 'u1',
  storeId: overrides.storeId ?? 's1',
  role: 'vendedora' as const,
  deletedAt: null,
});

describe('AssignmentService.list', () => {
  it('returns active assignments for the user', async () => {
    users.findById.mockResolvedValue(staffUser());
    assignments.listActiveByUser.mockResolvedValue([{ id: 'a1', storeId: 's1' }]);

    const result = await service.list('u1');

    expect(assignments.listActiveByUser).toHaveBeenCalledWith('u1');
    expect(result).toHaveLength(1);
  });

  it('throws USER_NOT_FOUND when user does not exist', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.list('missing')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('AssignmentService.create', () => {
  it('creates an assignment for a staff user', async () => {
    users.findById.mockResolvedValue(staffUser());
    assignments.findActiveByUserStore.mockResolvedValue(null);
    assignments.create.mockResolvedValue({ id: 'a1', storeId: 's1', role: 'vendedora' });

    const result = await service.create('u1', { storeId: 's1', role: 'vendedora' });

    expect(assignments.create).toHaveBeenCalledWith({
      userId: 'u1',
      storeId: 's1',
      role: 'vendedora',
    });
    expect(result.storeId).toBe('s1');
  });

  it('rejects when target user is admin (ASSIGNMENT_INVALID_FOR_ADMIN)', async () => {
    users.findById.mockResolvedValue(adminUser());
    await expect(service.create('admin1', { storeId: 's1', role: 'vendedora' })).rejects.toMatchObject({
      code: 'ASSIGNMENT_INVALID_FOR_ADMIN',
      statusCode: 400,
    });
    expect(assignments.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate active assignment (ASSIGNMENT_DUPLICATE)', async () => {
    users.findById.mockResolvedValue(staffUser());
    assignments.findActiveByUserStore.mockResolvedValue(assignmentRow());

    await expect(service.create('u1', { storeId: 's1', role: 'vendedora' })).rejects.toMatchObject({
      code: 'ASSIGNMENT_DUPLICATE',
      statusCode: 409,
    });
    expect(assignments.create).not.toHaveBeenCalled();
  });

  it('throws USER_NOT_FOUND when user does not exist', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.create('missing', { storeId: 's1', role: 'vendedora' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('AssignmentService.updateRole', () => {
  it('changes the role of an existing assignment', async () => {
    assignments.findById.mockResolvedValue(assignmentRow());
    assignments.updateRole.mockResolvedValue({ id: 'a1', role: 'encargada' });

    const result = await service.updateRole('u1', 'a1', { role: 'encargada' });

    expect(assignments.updateRole).toHaveBeenCalledWith('a1', 'encargada');
    expect(result.role).toBe('encargada');
  });

  it('throws ASSIGNMENT_NOT_FOUND when the row does not belong to the user', async () => {
    assignments.findById.mockResolvedValue(assignmentRow({ userId: 'other-user' }));
    await expect(service.updateRole('u1', 'a1', { role: 'encargada' })).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('throws ASSIGNMENT_NOT_FOUND when row is missing', async () => {
    assignments.findById.mockResolvedValue(null);
    await expect(service.updateRole('u1', 'a1', { role: 'encargada' })).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('AssignmentService.remove', () => {
  it('soft-deletes the assignment when there are others remaining', async () => {
    assignments.findById.mockResolvedValue(assignmentRow());
    assignments.countActiveByUser.mockResolvedValue(2);

    await service.remove('u1', 'a1', {});

    expect(assignments.softDelete).toHaveBeenCalledWith('a1');
  });

  it('blocks removing the LAST assignment without confirm', async () => {
    assignments.findById.mockResolvedValue(assignmentRow());
    assignments.countActiveByUser.mockResolvedValue(1);

    await expect(service.remove('u1', 'a1', {})).rejects.toMatchObject({
      code: 'ASSIGNMENT_LAST_REMOVAL_REQUIRES_CONFIRM',
      statusCode: 409,
    });
    expect(assignments.softDelete).not.toHaveBeenCalled();
  });

  it('allows removing the LAST assignment with confirm=true', async () => {
    assignments.findById.mockResolvedValue(assignmentRow());
    assignments.countActiveByUser.mockResolvedValue(1);

    await service.remove('u1', 'a1', { confirm: true });

    expect(assignments.softDelete).toHaveBeenCalledWith('a1');
  });

  it('throws ASSIGNMENT_NOT_FOUND when row does not belong to user', async () => {
    assignments.findById.mockResolvedValue(assignmentRow({ userId: 'other-user' }));
    await expect(service.remove('u1', 'a1', {})).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_FOUND',
      statusCode: 404,
    });
    expect(assignments.softDelete).not.toHaveBeenCalled();
  });
});
