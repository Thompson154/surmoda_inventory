import type { Prisma, Role } from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import type { ListUsersQuery, PaginatedUsers, UserDTO } from './types';

export interface CreateUserPersistInput {
  email: string;
  passwordHash: string;
  fullName: string;
  isAdmin: boolean;
  assignments: Array<{ storeId: string; role: Role }>;
}

export interface UpdateUserPersistInput {
  fullName?: string;
  isAdmin?: boolean;
}

export interface UserRepository {
  findById(id: string): Promise<UserDTO | null>;
  findByEmail(email: string): Promise<{ id: string; email: string } | null>;
  create(input: CreateUserPersistInput): Promise<UserDTO>;
  list(query: ListUsersQuery): Promise<PaginatedUsers>;
  update(id: string, input: UpdateUserPersistInput): Promise<UserDTO>;
  setActive(id: string, isActive: boolean): Promise<UserDTO>;
  countActiveAdmins(): Promise<number>;
  isAdminById(id: string): Promise<boolean>;
}

const userInclude = { assignments: true } as const;

export function buildUserRepository(db: Database): UserRepository {
  return {
    async findById(id) {
      const user = await db.user.findFirst({
        where: { id, deletedAt: null },
        include: userInclude,
      });
      return user ? toUserDTO(user) : null;
    },

    async findByEmail(email) {
      const user = await db.user.findFirst({
        where: { email, deletedAt: null },
        select: { id: true, email: true },
      });
      return user;
    },

    async create(input) {
      const created = await db.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          fullName: input.fullName,
          isAdmin: input.isAdmin,
          assignments: {
            create: input.assignments.map((a) => ({ storeId: a.storeId, role: a.role })),
          },
        },
        include: userInclude,
      });
      return toUserDTO(created);
    },

    async list(query) {
      const where: Prisma.UserWhereInput = { deletedAt: null };
      if (query.q) {
        const q = query.q;
        where.OR = [
          { email: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (query.isActive !== undefined) where.isActive = query.isActive;
      if (query.isAdmin !== undefined) where.isAdmin = query.isAdmin;

      const skip = (query.page - 1) * query.pageSize;

      const [items, total] = await Promise.all([
        db.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.pageSize,
          include: { _count: { select: { assignments: { where: { deletedAt: null } } } } },
        }),
        db.user.count({ where }),
      ]);

      return {
        items: items.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          isAdmin: u.isAdmin,
          isActive: u.isActive,
          assignmentsCount: u._count.assignments,
          createdAt: u.createdAt.toISOString(),
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async update(id, input) {
      const data: Prisma.UserUpdateInput = {};
      if (input.fullName !== undefined) data.fullName = input.fullName;
      if (input.isAdmin !== undefined) data.isAdmin = input.isAdmin;

      const updated = await db.user.update({
        where: { id },
        data,
        include: userInclude,
      });
      return toUserDTO(updated);
    },

    async setActive(id, isActive) {
      const updated = await db.user.update({
        where: { id },
        data: { isActive },
        include: userInclude,
      });
      return toUserDTO(updated);
    },

    async countActiveAdmins() {
      return db.user.count({
        where: { isAdmin: true, isActive: true, deletedAt: null },
      });
    },

    async isAdminById(id) {
      const u = await db.user.findFirst({
        where: { id, deletedAt: null },
        select: { isAdmin: true },
      });
      return Boolean(u?.isAdmin);
    },
  };
}

function toUserDTO(user: {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignments: Array<{
    id: string;
    storeId: string;
    role: Role;
    deletedAt: Date | null;
  }>;
}): UserDTO {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    assignments: user.assignments
      .filter((a) => a.deletedAt === null)
      .map((a) => ({ id: a.id, storeId: a.storeId, role: a.role })),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
