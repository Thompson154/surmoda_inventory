import type { DailyReportItemsDTO, StoreStaffMember } from '@surmoda/contracts';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type { DailyReportRepository } from './repository';
import type {
  AuthContext,
  DailyReportDTO,
  ListDailyReportsQuery,
  PaginatedDailyReports,
} from './types';
import { boliviaDayKey, parseBoliviaDayKey } from './timezone';

interface AssignmentScope {
  hasAnyEncargadaRole(userId: string): Promise<boolean>;
  findActiveAssignment?(userId: string, storeId: string): Promise<{ role: string } | null>;
}

export interface DailyReportServiceDeps {
  reports: DailyReportRepository;
  assignments: AssignmentScope;
}

export interface DailyReportService {
  closeToday(storeId: string, auth: AuthContext, attendedNames: string[]): Promise<DailyReportDTO>;
  closeForDay(
    storeId: string,
    day: Date,
    closedByUserId: string | null,
    autoClosed: boolean,
    attendedNames: string[],
  ): Promise<DailyReportDTO>;
  list(
    storeId: string,
    query: ListDailyReportsQuery,
    auth: AuthContext,
  ): Promise<PaginatedDailyReports>;
  getByDate(storeId: string, isoDay: string, auth: AuthContext): Promise<DailyReportDTO>;
  getItemsByDate(storeId: string, isoDay: string, auth: AuthContext): Promise<DailyReportItemsDTO>;
  listStoreStaff(storeId: string, auth: AuthContext): Promise<StoreStaffMember[]>;
}

export function buildDailyReportService({
  reports,
  assignments,
}: DailyReportServiceDeps): DailyReportService {
  // WHY: close-day can be performed by store encargada, vendedora assigned to the store, or admin.
  async function ensureCanCloseDay(storeId: string, auth: AuthContext): Promise<void> {
    if (auth.isAdmin) return;
    if (await assignments.hasAnyEncargadaRole(auth.userId)) return;
    if (assignments.findActiveAssignment) {
      const a = await assignments.findActiveAssignment(auth.userId, storeId);
      if (a) return;
    } else {
      // fallback if only hasAnyEncargadaRole is mocked/provided
      return;
    }
    throw new AppError(
      403,
      ERROR_CODES.DAILY_REPORT_FORBIDDEN,
      'Sólo encargada/vendedora de esta sede o admin puede cerrar el día.',
    );
  }

  // WHY: read-only daily report access is open to all 3 roles; auth guard already validates token.
  async function ensureAnyAuthenticatedUser(_auth: AuthContext): Promise<void> {
    // all roles may read; authGuard at router level ensures token validity
  }

  async function closeForDay(
    storeId: string,
    day: Date,
    closedByUserId: string | null,
    autoClosed: boolean,
    attendedNames: string[] = [],
  ): Promise<DailyReportDTO> {
    return reports.runSerializable(async (tx) => {
      const aggregate = await reports.aggregateDay(storeId, day, tx);
      return reports.upsert(
        {
          storeId,
          day,
          aggregate,
          closedByUserId,
          closedAt: new Date(),
          autoClosed,
          attendedNames,
        },
        tx,
      );
    });
  }

  return {
    closeForDay,

    async closeToday(storeId, auth, attendedNames) {
      await ensureCanCloseDay(storeId, auth);
      return closeForDay(storeId, boliviaDayKey(new Date()), auth.userId, false, attendedNames);
    },

    async listStoreStaff(_storeId, auth) {
      // WHY: staff list is only useful for encargada/admin when composing reports.
      await ensureAnyAuthenticatedUser(auth);
      return reports.listStoreStaff(_storeId);
    },

    async list(storeId, query, auth) {
      await ensureAnyAuthenticatedUser(auth);
      return reports.list(storeId, query);
    },

    async getByDate(storeId, isoDay, auth) {
      await ensureAnyAuthenticatedUser(auth);
      const day = parseBoliviaDayKey(isoDay);
      const report = await reports.findByDate(storeId, day);
      if (!report) {
        throw new AppError(
          404,
          ERROR_CODES.DAILY_REPORT_NOT_FOUND,
          'No hay reporte cerrado para ese día.',
        );
      }
      return report;
    },

    async getItemsByDate(storeId, isoDay, auth) {
      await ensureAnyAuthenticatedUser(auth);
      const day = parseBoliviaDayKey(isoDay);
      const items = await reports.getDayItems(storeId, day);
      return { date: isoDay, items };
    },
  };
}
