// Unit tests for dailyReports RBAC: close-day vendedora-only rule.
// RED phase: written before service fixes.

import { buildDailyReportService } from '../service';
import type { DailyReportRepository } from '../repository';
import type { AuthContext } from '../types';

function buildMockRepo(): jest.Mocked<DailyReportRepository> {
  return {
    runSerializable: jest.fn(async (fn) => fn({})),
    aggregateDay: jest
      .fn()
      .mockResolvedValue({ totalCents: 0, saleCount: 0, itemCount: 0, totalUnits: 0 }),
    upsert: jest.fn().mockResolvedValue({ id: 'report-1', storeId: 's1', day: new Date() }),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findByDate: jest.fn(),
    getDayItems: jest.fn(),
    listStoreStaff: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<DailyReportRepository>;
}

function buildMockAssignments(isEncargada = false) {
  return {
    hasAnyEncargadaRole: jest.fn().mockResolvedValue(isEncargada),
  };
}

const STORE_ID = 'store-1';

const ADMIN_AUTH: AuthContext = { userId: 'admin-1', isAdmin: true };
const VENDEDORA_AUTH: AuthContext = { userId: 'vend-1', isAdmin: false };
const ENCARGADA_AUTH: AuthContext = { userId: 'enc-1', isAdmin: false };

describe('DailyReportService.closeToday — RBAC', () => {
  it('allows admin to close today', async () => {
    const repo = buildMockRepo();
    const assignments = buildMockAssignments(false);
    const service = buildDailyReportService({ reports: repo, assignments });

    await expect(service.closeToday(STORE_ID, ADMIN_AUTH, [])).resolves.toBeDefined();
  });

  it('allows vendedora to close today', async () => {
    const repo = buildMockRepo();
    const assignments = buildMockAssignments(false);
    const service = buildDailyReportService({ reports: repo, assignments });

    await expect(service.closeToday(STORE_ID, VENDEDORA_AUTH, [])).resolves.toBeDefined();
  });

  it('forbids encargada from closing today', async () => {
    const repo = buildMockRepo();
    // WHY: encargada is encargada, not vendedora — close-day is vendedora-only.
    const assignments = buildMockAssignments(true);
    const service = buildDailyReportService({ reports: repo, assignments });

    await expect(service.closeToday(STORE_ID, ENCARGADA_AUTH, [])).rejects.toMatchObject({
      statusCode: 403,
      code: 'DAILY_REPORT_FORBIDDEN',
    });
  });
});

describe('DailyReportService.list — RBAC', () => {
  it('allows admin to list', async () => {
    const repo = buildMockRepo();
    const assignments = buildMockAssignments(false);
    const service = buildDailyReportService({ reports: repo, assignments });

    await expect(
      service.list(STORE_ID, { page: 1, pageSize: 10 }, ADMIN_AUTH),
    ).resolves.toBeDefined();
  });

  it('allows encargada to list', async () => {
    const repo = buildMockRepo();
    const assignments = buildMockAssignments(true);
    const service = buildDailyReportService({ reports: repo, assignments });

    await expect(
      service.list(STORE_ID, { page: 1, pageSize: 10 }, ENCARGADA_AUTH),
    ).resolves.toBeDefined();
  });

  it('allows vendedora to list', async () => {
    const repo = buildMockRepo();
    const assignments = buildMockAssignments(false);
    const service = buildDailyReportService({ reports: repo, assignments });

    await expect(
      service.list(STORE_ID, { page: 1, pageSize: 10 }, VENDEDORA_AUTH),
    ).resolves.toBeDefined();
  });
});
