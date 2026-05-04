import type { Database } from '../../infrastructure/database';

export interface DeliveryEditRequestRow {
  id: string;
  deliveryId: string;
  requesterId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface DeliveryHeader {
  id: string;
  status: 'draft' | 'sent' | 'received' | 'partial';
  toStoreId: string;
  fromStoreId: string | null;
}

export interface CreateDeliveryEditRequestInput {
  deliveryId: string;
  requesterId: string;
  reason: string;
}

export interface ListDeliveryEditRequestsFilter {
  status?: 'pending' | 'approved' | 'rejected';
  storeId?: string;
  page: number;
  pageSize: number;
}

export interface PaginatedDeliveryEditRequests {
  rows: DeliveryEditRequestRow[];
  total: number;
}

export interface RejectDeliveryEditRequestInput {
  id: string;
  reviewerId: string;
  rejectionReason: string;
}

export interface ApproveDeliveryEditRequestInput {
  id: string;
  reviewerId: string;
}

export interface DeliveryEditRequestRepository {
  findDeliveryHeader(deliveryId: string): Promise<DeliveryHeader | null>;
  create(input: CreateDeliveryEditRequestInput): Promise<DeliveryEditRequestRow>;
  findById(id: string): Promise<DeliveryEditRequestRow | null>;
  listByDelivery(deliveryId: string): Promise<DeliveryEditRequestRow[]>;
  listAll(filter: ListDeliveryEditRequestsFilter): Promise<PaginatedDeliveryEditRequests>;
  approve(input: ApproveDeliveryEditRequestInput): Promise<DeliveryEditRequestRow>;
  reject(input: RejectDeliveryEditRequestInput): Promise<DeliveryEditRequestRow>;
}

function mapStatus(s: string): 'pending' | 'approved' | 'rejected' {
  if (s === 'pending' || s === 'approved' || s === 'rejected') return s;
  return 'pending';
}

function mapDeliveryStatus(s: string): 'draft' | 'sent' | 'received' | 'partial' {
  if (s === 'draft' || s === 'sent' || s === 'received' || s === 'partial') return s;
  return 'draft';
}

function toRow(r: {
  id: string;
  deliveryId: string;
  requesterId: string;
  reason: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}): DeliveryEditRequestRow {
  return {
    id: r.id,
    deliveryId: r.deliveryId,
    requesterId: r.requesterId,
    reason: r.reason,
    status: mapStatus(r.status),
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt,
  };
}

export function buildDeliveryEditRequestRepository(db: Database): DeliveryEditRequestRepository {
  return {
    async findDeliveryHeader(deliveryId) {
      const d = await db.delivery.findUnique({
        where: { id: deliveryId },
        select: { id: true, status: true, toStoreId: true, fromStoreId: true },
      });
      if (!d) return null;
      return {
        id: d.id,
        status: mapDeliveryStatus(d.status),
        toStoreId: d.toStoreId,
        fromStoreId: d.fromStoreId,
      };
    },

    async create(input) {
      const row = await db.deliveryEditRequest.create({
        data: {
          deliveryId: input.deliveryId,
          requesterId: input.requesterId,
          reason: input.reason,
          status: 'pending',
        },
      });
      return toRow(row);
    },

    async findById(id) {
      const r = await db.deliveryEditRequest.findUnique({ where: { id } });
      return r ? toRow(r) : null;
    },

    async listByDelivery(deliveryId) {
      const rows = await db.deliveryEditRequest.findMany({
        where: { deliveryId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(toRow);
    },

    async listAll(filter) {
      const where: {
        status?: 'pending' | 'approved' | 'rejected';
        delivery?: { toStoreId: string };
      } = {};
      if (filter.status) where.status = filter.status;
      if (filter.storeId) where.delivery = { toStoreId: filter.storeId };

      const [rows, total] = await db.$transaction([
        db.deliveryEditRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (filter.page - 1) * filter.pageSize,
          take: filter.pageSize,
        }),
        db.deliveryEditRequest.count({ where }),
      ]);

      return { rows: rows.map(toRow), total };
    },

    async approve(input) {
      const r = await db.deliveryEditRequest.update({
        where: { id: input.id },
        data: {
          status: 'approved',
          reviewedBy: input.reviewerId,
          reviewedAt: new Date(),
        },
      });
      return toRow(r);
    },

    async reject(input) {
      const r = await db.deliveryEditRequest.update({
        where: { id: input.id },
        data: {
          status: 'rejected',
          reviewedBy: input.reviewerId,
          reviewedAt: new Date(),
          rejectionReason: input.rejectionReason,
        },
      });
      return toRow(r);
    },
  };
}
