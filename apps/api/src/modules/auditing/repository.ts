// Read-side of the audit module. The write-side lives in service.ts and is
// fire-and-forget (constitution PARTE VI § 6.2 — audit MUST NOT add latency).
//
// This file powers the admin/encargada audit viewer (module 12). Both filters
// (userId, storeId) are optional and combined with AND when supplied.

import type { Database } from '../../infrastructure/database';
import type { AuditLogListResponse, AuditLogRow } from '@surmoda/contracts';

export interface AuditQueryFilters {
  userId?: string;
  storeId?: string;
  page: number;
  pageSize: number;
}

export interface AuditRepository {
  list(filters: AuditQueryFilters): Promise<AuditLogListResponse>;
}

export function buildAuditRepository(db: Database): AuditRepository {
  return {
    async list({ userId, storeId, page, pageSize }) {
      // Store filter: an event is "in store X" if any of these is true:
      //   1. payload.storeId  === X       (sales, inventory, daily-reports, intake)
      //   2. payload.toStoreId === X      (deliveries — destination)
      //   3. payload.fromStoreId === X    (deliveries — origin / lateral transfers)
      //   4. entity = 'Store' AND entityId = X (store CRUD)
      // Events without any store reference (auth, user CRUD, product CRUD)
      // simply don't match — that's correct semantically: they are global.
      const storeFilter = storeId
        ? {
            OR: [
              { payload: { path: ['storeId'], equals: storeId } },
              { payload: { path: ['toStoreId'], equals: storeId } },
              { payload: { path: ['fromStoreId'], equals: storeId } },
              { AND: [{ entity: 'Store' }, { entityId: storeId }] },
            ],
          }
        : null;

      const userFilter = userId ? { userId } : null;

      const where = {
        AND: [
          ...(userFilter ? [userFilter] : []),
          ...(storeFilter ? [storeFilter] : []),
        ],
      };

      // userId is nullable on AuditLog so we hydrate user labels via a single
      // batch lookup rather than a Prisma `include` join (which would fail-soft
      // on anonymous events anyway).
      const [rows, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.auditLog.count({ where }),
      ]);

      // Hydrate user labels in a single batch — avoids N+1.
      const userIds = Array.from(
        new Set(rows.map((r) => r.userId).filter((u): u is string => u !== null)),
      );
      const userLabelMap = new Map<string, string>();
      if (userIds.length > 0) {
        const users = await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, email: true },
        });
        for (const u of users) {
          userLabelMap.set(u.id, u.fullName || u.email);
        }
      }

      const items: AuditLogRow[] = rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        userId: r.userId,
        userLabel: r.userId ? (userLabelMap.get(r.userId) ?? null) : null,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        payload: (r.payload ?? {}) as Record<string, unknown>,
        ip: r.ip,
        userAgent: r.userAgent,
      }));

      return { items, total, page, pageSize };
    },
  };
}
