import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { bcryptSaltRounds } from '../../shared/constants/tokenConfig';
import type { CreateUserDTO, ListUsersQuery, PaginatedUsers, UpdateUserDTO, UserDTO } from './types';
import type { UserRepository } from './repository';
import type { RefreshTokenRepository } from '../auth/repository';

export interface UserServiceDeps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
}

export interface UserService {
  create(input: CreateUserDTO): Promise<UserDTO>;
  list(query: ListUsersQuery): Promise<PaginatedUsers>;
  getById(id: string): Promise<UserDTO>;
  update(id: string, input: UpdateUserDTO): Promise<UserDTO>;
  deactivate(id: string): Promise<UserDTO>;
  reactivate(id: string): Promise<UserDTO>;
}

export function buildUserService({ users, refreshTokens }: UserServiceDeps): UserService {
  async function ensureNotDemotingLastAdmin(id: string, willStillBeAdmin: boolean) {
    if (willStillBeAdmin) return;
    const isCurrentlyAdmin = await users.isAdminById(id);
    if (!isCurrentlyAdmin) return;
    const adminCount = await users.countActiveAdmins();
    if (adminCount <= 1) {
      throw new AppError(
        409,
        ERROR_CODES.USER_DEACTIVATE_LAST_ADMIN,
        'Cannot demote or deactivate the last active admin',
      );
    }
  }

  return {
    async create(input) {
      // WHY: pre-check is for a friendly error code; the unique constraint is the source of truth.
      const existing = await users.findByEmail(input.email);
      if (existing) {
        throw new AppError(409, ERROR_CODES.USER_CREATE_DUPLICATE_EMAIL, 'Email already in use');
      }

      const passwordHash = await bcrypt.hash(input.password, bcryptSaltRounds());

      try {
        return await users.create({
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          isAdmin: input.isAdmin,
          assignments: input.assignments ?? [],
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError(409, ERROR_CODES.USER_CREATE_DUPLICATE_EMAIL, 'Email already in use');
        }
        throw err;
      }
    },

    async list(query) {
      return users.list(query);
    },

    async getById(id) {
      const user = await users.findById(id);
      if (!user) {
        throw new AppError(404, ERROR_CODES.USER_NOT_FOUND, 'User not found');
      }
      return user;
    },

    async update(id, input) {
      const current = await users.findById(id);
      if (!current) {
        throw new AppError(404, ERROR_CODES.USER_NOT_FOUND, 'User not found');
      }

      // Last-admin protection on demote
      if (input.isAdmin === false) {
        await ensureNotDemotingLastAdmin(id, /* willStillBeAdmin */ false);
      }

      return users.update(id, input);
    },

    async deactivate(id) {
      const current = await users.findById(id);
      if (!current) {
        throw new AppError(404, ERROR_CODES.USER_NOT_FOUND, 'User not found');
      }
      if (!current.isActive) return current; // idempotent

      // Last-admin protection
      if (current.isAdmin) {
        await ensureNotDemotingLastAdmin(id, /* willStillBeAdmin */ false);
      }

      const updated = await users.setActive(id, false);
      // Revoke ALL refresh tokens — user can't log in anywhere
      await refreshTokens.revokeAllForUser(id);
      return updated;
    },

    async reactivate(id) {
      const current = await users.findById(id);
      if (!current) {
        throw new AppError(404, ERROR_CODES.USER_NOT_FOUND, 'User not found');
      }
      if (current.isActive) return current; // idempotent
      return users.setActive(id, true);
    },
  };
}
