import type { Role } from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import type { AssignmentDTO } from './types';

export interface AssignmentRow {
  id: string;
  userId: string;
  storeId: string;
  role: Role;
  deletedAt: Date | null;
}

export interface CreateAssignmentInput {
  userId: string;
  storeId: string;
  role: Role;
}

export interface UserStoreRepository {
  listActiveByUser(userId: string): Promise<AssignmentDTO[]>;
  countActiveByUser(userId: string): Promise<number>;
  findById(id: string): Promise<AssignmentRow | null>;
  findActiveByUserStore(userId: string, storeId: string): Promise<AssignmentRow | null>;
  create(input: CreateAssignmentInput): Promise<AssignmentDTO>;
  updateRole(id: string, role: Role): Promise<AssignmentDTO>;
  softDelete(id: string): Promise<void>;
}

export function buildUserStoreRepository(db: Database): UserStoreRepository {
  return {
    async listActiveByUser(userId) {
      const rows = await db.userStore.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(toDTO);
    },

    async countActiveByUser(userId) {
      return db.userStore.count({ where: { userId, deletedAt: null } });
    },

    async findById(id) {
      const row = await db.userStore.findUnique({ where: { id } });
      return row ? toRow(row) : null;
    },

    async findActiveByUserStore(userId, storeId) {
      const row = await db.userStore.findFirst({
        where: { userId, storeId, deletedAt: null },
      });
      return row ? toRow(row) : null;
    },

    async create(input) {
      const created = await db.userStore.create({
        data: {
          userId: input.userId,
          storeId: input.storeId,
          role: input.role,
        },
      });
      return toDTO(created);
    },

    async updateRole(id, role) {
      const updated = await db.userStore.update({
        where: { id },
        data: { role },
      });
      return toDTO(updated);
    },

    async softDelete(id) {
      await db.userStore.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    },
  };
}

function toDTO(row: {
  id: string;
  userId: string;
  storeId: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}): AssignmentDTO {
  return {
    id: row.id,
    userId: row.userId,
    storeId: row.storeId,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRow(row: {
  id: string;
  userId: string;
  storeId: string;
  role: Role;
  deletedAt: Date | null;
}): AssignmentRow {
  return {
    id: row.id,
    userId: row.userId,
    storeId: row.storeId,
    role: row.role,
    deletedAt: row.deletedAt,
  };
}
