import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import { bcryptSaltRounds } from '../../shared/constants/tokenConfig';
import type { CreateUserDTO, ListUsersQuery, PaginatedUsers, UserDTO } from './types';
import type { UserRepository } from './repository';

export interface UserServiceDeps {
  users: UserRepository;
}

export interface UserService {
  create(input: CreateUserDTO): Promise<UserDTO>;
  list(query: ListUsersQuery): Promise<PaginatedUsers>;
  getById(id: string): Promise<UserDTO>;
}

export function buildUserService({ users }: UserServiceDeps): UserService {
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
  };
}
