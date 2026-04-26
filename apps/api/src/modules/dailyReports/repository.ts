import { Prisma } from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import type { DailyReportItemDTO } from '@surmoda/contracts';
import type {
  DailyReportDTO,
  ListDailyReportsQuery,
  PaginatedDailyReports,
} from './types';
import { boliviaDayWindow, parseBoliviaDayKey } from './timezone';

export type DailyReportTx = Prisma.TransactionClient;

interface DayAggregate {
  totalCents: number;
  qrCents: number;
  cardCents: number;
  cashCents: number;
  itemCount: number;
  transactionsCount: number;
}

export interface DailyReportRepository {
  aggregateDay(storeId: string, day: Date, tx?: DailyReportTx): Promise<DayAggregate>;
  upsert(input: {
    storeId: string;
    day: Date;
    aggregate: DayAggregate;
    closedByUserId: string | null;
    closedAt: Date;
    autoClosed: boolean;
    attendedNames: string[];
  }, tx?: DailyReportTx): Promise<DailyReportDTO>;
  findByDate(storeId: string, day: Date): Promise<DailyReportDTO | null>;
  getDayItems(storeId: string, day: Date): Promise<DailyReportItemDTO[]>;
  list(storeId: string, query: ListDailyReportsQuery): Promise<PaginatedDailyReports>;
  listActiveStores(): Promise<Array<{ id: string }>>;
  findFirstSaleDay(storeId: string): Promise<Date | null>;
  listStoreStaff(storeId: string): Promise<Array<{ userId: string; fullName: string; role: 'encargada' | 'vendedora' }>>;
  runSerializable<T>(fn: (tx: DailyReportTx) => Promise<T>): Promise<T>;
}

export function buildDailyReportRepository(db: Database): DailyReportRepository {
  function client(tx?: DailyReportTx): DailyReportTx | Database {
    return tx ?? db;
  }

  function rowToDTO(row: {
    id: string;
    storeId: string;
    date: Date;
    totalCents: number;
    qrCents: number;
    cardCents: number;
    cashCents: number;
    itemCount: number;
    transactionsCount: number;
    closedByUserId: string | null;
    closedAt: Date;
    autoClosed: boolean;
    user?: { fullName: string } | null;
    attendees?: Array<{ fullName: string; userId: string | null }>;
  }): DailyReportDTO {
    // The DB column is `DATE` so Prisma returns 00:00 UTC for the stored day —
    // slicing the ISO string is timezone-agnostic and keeps the YYYY-MM-DD
    // exactly as it was written.
    return {
      id: row.id,
      storeId: row.storeId,
      date: row.date.toISOString().slice(0, 10),
      totalCents: row.totalCents,
      qrCents: row.qrCents,
      cardCents: row.cardCents,
      cashCents: row.cashCents,
      itemCount: row.itemCount,
      transactionsCount: row.transactionsCount,
      closedByUserId: row.closedByUserId,
      closedByFullName: row.user?.fullName ?? null,
      closedAt: row.closedAt.toISOString(),
      autoClosed: row.autoClosed,
      attendees: (row.attendees ?? []).map((a) => ({
        fullName: a.fullName,
        userId: a.userId,
      })),
    };
  }

  const dtoInclude = {
    user: { select: { fullName: true } },
    attendees: { select: { fullName: true, userId: true } },
  } as const;

  return {
    async aggregateDay(storeId, day, tx) {
      const c = client(tx);
      const { start, end } = boliviaDayWindow(day);
      const sales = await c.sale.findMany({
        where: { storeId, createdAt: { gte: start, lt: end } },
        include: { items: { select: { quantity: true } } },
      });

      let totalCents = 0;
      let qrCents = 0;
      let cardCents = 0;
      let cashCents = 0;
      let itemCount = 0;
      for (const s of sales) {
        totalCents += s.totalCents;
        if (s.paymentMethod === 'qr') qrCents += s.totalCents;
        else if (s.paymentMethod === 'card') cardCents += s.totalCents;
        else cashCents += s.totalCents;
        for (const it of s.items) itemCount += it.quantity;
      }
      return {
        totalCents,
        qrCents,
        cardCents,
        cashCents,
        itemCount,
        transactionsCount: sales.length,
      };
    },

    async upsert(input, tx) {
      const c = client(tx);
      const day = input.day;
      const upserted = await c.dailyReport.upsert({
        where: { storeId_date: { storeId: input.storeId, date: day } },
        create: {
          storeId: input.storeId,
          date: day,
          totalCents: input.aggregate.totalCents,
          qrCents: input.aggregate.qrCents,
          cardCents: input.aggregate.cardCents,
          cashCents: input.aggregate.cashCents,
          itemCount: input.aggregate.itemCount,
          transactionsCount: input.aggregate.transactionsCount,
          closedByUserId: input.closedByUserId,
          closedAt: input.closedAt,
          autoClosed: input.autoClosed,
        },
        update: {
          totalCents: input.aggregate.totalCents,
          qrCents: input.aggregate.qrCents,
          cardCents: input.aggregate.cardCents,
          cashCents: input.aggregate.cashCents,
          itemCount: input.aggregate.itemCount,
          transactionsCount: input.aggregate.transactionsCount,
          closedByUserId: input.closedByUserId,
          closedAt: input.closedAt,
          autoClosed: input.autoClosed,
        },
        select: { id: true },
      });

      // Reset attendance roster: cierre is idempotent so any prior list for
      // the same day is replaced. Skipped on auto-close (empty list).
      await c.dailyReportAttendance.deleteMany({ where: { dailyReportId: upserted.id } });
      if (input.attendedNames.length > 0) {
        // Dedup by lowercased trimmed name so duplicate chips don't create rows.
        const seen = new Set<string>();
        const unique = input.attendedNames
          .map((n) => n.trim())
          .filter((n) => {
            if (!n) return false;
            const key = n.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        if (unique.length > 0) {
          await c.dailyReportAttendance.createMany({
            data: unique.map((fullName) => ({
              dailyReportId: upserted.id,
              fullName,
              // Try to link to a real account if the name matches exactly — purely
              // a convenience for analytics, not enforced.
              userId: null,
            })),
          });
        }
      }

      const full = await c.dailyReport.findUniqueOrThrow({
        where: { id: upserted.id },
        include: dtoInclude,
      });
      return rowToDTO(full);
    },

    async findByDate(storeId, day) {
      const row = await db.dailyReport.findUnique({
        where: { storeId_date: { storeId, date: day } },
        include: dtoInclude,
      });
      return row ? rowToDTO(row) : null;
    },

    async getDayItems(storeId, day) {
      const { start, end } = boliviaDayWindow(day);
      const rows = await db.saleItem.findMany({
        where: {
          sale: { storeId, createdAt: { gte: start, lt: end } },
        },
        include: {
          variant: {
            select: {
              id: true,
              size: true,
              color: true,
              barcode: true,
              product: { select: { code: true, name: true } },
            },
          },
        },
      });

      const SIZE_LABEL: Record<string, string> = {
        s: 'S', m: 'M', l: 'L', xl: 'XL', xxl: 'XXL',
        size_28: '28', size_30: '30', size_32: '32', size_34: '34', standard: 'standard',
      };

      const map = new Map<string, DailyReportItemDTO>();
      for (const r of rows) {
        const key = r.variantId;
        const existing = map.get(key);
        const lineTotal = r.priceAtSaleCents * r.quantity;
        if (existing) {
          existing.quantity += r.quantity;
          existing.totalCents += lineTotal;
        } else {
          map.set(key, {
            variantId: r.variantId,
            productCode: r.variant.product.code,
            productName: r.variant.product.name,
            size: SIZE_LABEL[r.variant.size] ?? r.variant.size,
            color: r.variant.color,
            barcode: r.variant.barcode,
            quantity: r.quantity,
            totalCents: lineTotal,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
    },

    async list(storeId, query) {
      const where: Prisma.DailyReportWhereInput = { storeId };
      if (query.from || query.to) {
        where.date = {};
        if (query.from) (where.date as Prisma.DateTimeFilter).gte = parseBoliviaDayKey(query.from);
        if (query.to) (where.date as Prisma.DateTimeFilter).lte = parseBoliviaDayKey(query.to);
      }
      const skip = (query.page - 1) * query.pageSize;
      const [rows, total] = await Promise.all([
        db.dailyReport.findMany({
          where,
          include: dtoInclude,
          orderBy: { date: 'desc' },
          skip,
          take: query.pageSize,
        }),
        db.dailyReport.count({ where }),
      ]);
      return {
        items: rows.map(rowToDTO),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async listActiveStores() {
      return db.store.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true },
      });
    },

    async findFirstSaleDay(storeId) {
      const row = await db.sale.findFirst({
        where: { storeId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      return row?.createdAt ?? null;
    },

    async listStoreStaff(storeId) {
      // Active assignments at this store, plus every encargada-anywhere
      // (post-feature-004 product decision: encargada is global, so she may
      // have helped at this store even without a direct assignment).
      const direct = await db.userStore.findMany({
        where: {
          storeId,
          deletedAt: null,
          user: { isActive: true, deletedAt: null },
        },
        select: { userId: true, role: true, user: { select: { fullName: true } } },
      });
      const globalEncargadas = await db.userStore.findMany({
        where: {
          role: 'encargada',
          deletedAt: null,
          storeId: { not: storeId },
          user: { isActive: true, deletedAt: null },
        },
        select: { userId: true, role: true, user: { select: { fullName: true } } },
        distinct: ['userId'],
      });

      const seen = new Set<string>();
      const out: Array<{ userId: string; fullName: string; role: 'encargada' | 'vendedora' }> = [];
      for (const r of [...direct, ...globalEncargadas]) {
        if (seen.has(r.userId)) continue;
        seen.add(r.userId);
        out.push({ userId: r.userId, fullName: r.user.fullName, role: r.role });
      }
      out.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
      return out;
    },

    async runSerializable(fn) {
      return db.$transaction((tx) => fn(tx as DailyReportTx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  };
}
