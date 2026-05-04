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
  // WHY: close-day is vendedora-only — encargada supervises, vendedora registers sales + closes.
  async function ensureVendedoraOrAdmin(auth: AuthContext): Promise<void> {
    if (auth.isAdmin) return;
    const isEncargada = await assignments.hasAnyEncargadaRole(auth.userId);
    if (isEncargada) {
      throw new AppError(
        403,
        ERROR_CODES.DAILY_REPORT_FORBIDDEN,
        'Sólo vendedora/admin puede cerrar el día.',
      );
    }
    // Non-admin, non-encargada = vendedora — allowed.
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
      await ensureVendedoraOrAdmin(auth);
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
