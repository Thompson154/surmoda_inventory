// Unit tests for AuditService — retroactive edit validation.
// RED phase: written before implementation of DAILY_CLOSURE_RETROACTIVE_EDIT guard.

// WHY: mock infrastructure/database to prevent Prisma.InputJsonValue from loading DB connection.
jest.mock('../../../infrastructure/database', () => ({
  Prisma: {},
  getPrisma: jest.fn(),
}));

import { buildAuditService } from '../service';
import type { Database } from '../../../infrastructure/database';
import { AppError } from '../../../shared/errors/AppError';

function buildMockDb(): Database {
  // WHY: create always returns a real promise so fire-and-forget .catch() doesn't crash.
  const create = jest.fn().mockResolvedValue({ id: 'audit-1' });
  return { auditLog: { create } } as unknown as Database;
}

// WHY: fake timers prevent setImmediate from firing between tests (resetMocks resets fn impls).
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('AuditService — DAILY_CLOSURE_RETROACTIVE_EDIT', () => {
  it('throws DAILY_CLOSURE_RETROACTIVE_EDIT_REASON_REQUIRED when reason is missing', () => {
    const db = buildMockDb();
    const service = buildAuditService(db);

    expect(() =>
      service.write({
        action: 'DAILY_CLOSURE_RETROACTIVE_EDIT',
        entity: 'DailyReport',
        entityId: 'report-1',
        userId: 'admin-1',
        // no payload.reason
        payload: { note: 'some other field' },
      }),
    ).toThrow(AppError);
  });

  it('throws with correct code when payload is completely absent', () => {
    const db = buildMockDb();
    const service = buildAuditService(db);

    expect(() =>
      service.write({
        action: 'DAILY_CLOSURE_RETROACTIVE_EDIT',
        entity: 'DailyReport',
        entityId: 'report-1',
        userId: 'admin-1',
      }),
    ).toThrow(expect.objectContaining({ code: 'DAILY_CLOSURE_RETROACTIVE_EDIT_REASON_REQUIRED' }));
  });

  it('does NOT throw when reason is provided', () => {
    const db = buildMockDb();
    const service = buildAuditService(db);

    expect(() =>
      service.write({
        action: 'DAILY_CLOSURE_RETROACTIVE_EDIT',
        entity: 'DailyReport',
        entityId: 'report-1',
        userId: 'admin-1',
        payload: { reason: 'Corrección autorizada por gerencia' },
      }),
    ).not.toThrow();
  });

  it('does NOT enforce reason for other actions', () => {
    const db = buildMockDb();
    const service = buildAuditService(db);

    expect(() =>
      service.write({
        action: 'SALE_CREATED',
        entity: 'Sale',
        entityId: 'sale-1',
        userId: 'admin-1',
        // no reason — fine for this action
      }),
    ).not.toThrow();
  });
});
