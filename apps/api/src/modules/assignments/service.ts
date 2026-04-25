import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type { UserStoreRepository } from './repository';
import type { UserRepository } from '../users/repository';
import type {
  AssignmentDTO,
  CreateAssignmentDTO,
  RemoveAssignmentOptions,
  UpdateAssignmentDTO,
} from './types';

export interface AssignmentServiceDeps {
  assignments: UserStoreRepository;
  users: UserRepository;
}

export interface AssignmentService {
  list(userId: string): Promise<AssignmentDTO[]>;
  create(userId: string, input: CreateAssignmentDTO): Promise<AssignmentDTO>;
  updateRole(userId: string, assignmentId: string, input: UpdateAssignmentDTO): Promise<AssignmentDTO>;
  remove(userId: string, assignmentId: string, options: RemoveAssignmentOptions): Promise<void>;
}

export function buildAssignmentService({ assignments, users }: AssignmentServiceDeps): AssignmentService {
  async function ensureUserExistsAndIsStaff(userId: string) {
    const user = await users.findById(userId);
    if (!user) {
      throw new AppError(404, ERROR_CODES.USER_NOT_FOUND, 'User not found');
    }
    if (user.isAdmin) {
      throw new AppError(
        400,
        ERROR_CODES.ASSIGNMENT_INVALID_FOR_ADMIN,
        'Admin users cannot have store assignments',
      );
    }
  }

  return {
    async list(userId) {
      const user = await users.findById(userId);
      if (!user) {
        throw new AppError(404, ERROR_CODES.USER_NOT_FOUND, 'User not found');
      }
      return assignments.listActiveByUser(userId);
    },

    async create(userId, input) {
      await ensureUserExistsAndIsStaff(userId);

      const existing = await assignments.findActiveByUserStore(userId, input.storeId);
      if (existing) {
        throw new AppError(
          409,
          ERROR_CODES.ASSIGNMENT_DUPLICATE,
          'User is already assigned to this store',
        );
      }

      return assignments.create({
        userId,
        storeId: input.storeId,
        role: input.role,
      });
    },

    async updateRole(userId, assignmentId, input) {
      const row = await assignments.findById(assignmentId);
      if (!row || row.deletedAt !== null || row.userId !== userId) {
        throw new AppError(404, ERROR_CODES.ASSIGNMENT_NOT_FOUND, 'Assignment not found');
      }
      return assignments.updateRole(assignmentId, input.role);
    },

    async remove(userId, assignmentId, options) {
      const row = await assignments.findById(assignmentId);
      if (!row || row.deletedAt !== null || row.userId !== userId) {
        throw new AppError(404, ERROR_CODES.ASSIGNMENT_NOT_FOUND, 'Assignment not found');
      }

      const activeCount = await assignments.countActiveByUser(userId);
      if (activeCount <= 1 && !options.confirm) {
        throw new AppError(
          409,
          ERROR_CODES.ASSIGNMENT_LAST_REMOVAL_REQUIRES_CONFIRM,
          'Removing the last assignment requires confirm=true (user will lose store access)',
        );
      }

      await assignments.softDelete(assignmentId);
    },
  };
}
