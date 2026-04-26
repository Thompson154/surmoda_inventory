import { Prisma } from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import {
  isoLocalDate,
  startOfBoliviaWeekMonday as startOfWeekMonday,
  startOfDayBolivia as startOfDayLocal,
} from '../../shared/datetime/bolivia';
import { PM_FROM_PRISMA, PM_TO_PRISMA, SIZE_FROM_PRISMA } from '../../shared/enums/mappings';
import type {
  ListSalesQuery,
  PaginatedSales,
  PaymentMethod,
  SaleWithItems,
  SalesDashboard,
} from './types';

export type SaleTx = Prisma.TransactionClient;

export interface VariantPriceSnapshot {
  variantId: string;
  priceCents: number;
}

export interface CreateSaleHeaderInput {
  storeId: string;
  recordedByUserId: string;
  paymentMethod: PaymentMethod;
  totalCents: number;
}

export interface CreateSaleItemRow {
  variantId: string;
  quantity: number;
  priceAtSaleCents: number;
  subtotalCents: number;
}

export interface SaleRepository {
  loadVariantPrices(variantIds: string[], tx: SaleTx): Promise<Map<string, number>>;
  variantsExistAndActive(variantIds: string[], tx: SaleTx): Promise<Set<string>>;
  loadStockForVariants(storeId: string, variantIds: string[], tx: SaleTx): Promise<Map<string, number>>;
  decrementStock(storeId: string, variantId: string, qty: number, tx: SaleTx): Promise<number>;
  createMovement(input: {
    storeId: string;
    variantId: string;
    userId: string;
    payload: Record<string, unknown>;
  }, tx: SaleTx): Promise<void>;
  createSale(header: CreateSaleHeaderInput, items: CreateSaleItemRow[], tx: SaleTx): Promise<{ id: string }>;
  findSale(saleId: string): Promise<SaleWithItems | null>;
  list(storeId: string, query: ListSalesQuery): Promise<PaginatedSales>;
  buildDashboard(storeId: string, now: Date): Promise<SalesDashboard>;
  runSerializable<T>(fn: (tx: SaleTx) => Promise<T>): Promise<T>;
}

export function buildSaleRepository(db: Database): SaleRepository {
  async function loadSale(c: SaleTx | Database, id: string): Promise<SaleWithItems | null> {
    const row = await c.sale.findUnique({
      where: { id },
      include: {
        store: { select: { name: true } },
        user: { select: { fullName: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!row) return null;
    const totalUnits = row.items.reduce((s, i) => s + i.quantity, 0);
    return {
      id: row.id,
      storeId: row.storeId,
      storeName: row.store.name,
      recordedByUserId: row.recordedByUserId,
      recordedByFullName: row.user.fullName,
      paymentMethod: PM_FROM_PRISMA[row.paymentMethod],
      totalCents: row.totalCents,
      itemCount: row.items.length,
      totalUnits,
      createdAt: row.createdAt.toISOString(),
      items: row.items.map((i) => ({
        id: i.id,
        variantId: i.variantId,
        quantity: i.quantity,
        priceAtSaleCents: i.priceAtSaleCents,
        subtotalCents: i.subtotalCents,
        productId: i.variant.productId,
        productCode: i.variant.product.code,
        productName: i.variant.product.name,
        size: SIZE_FROM_PRISMA[i.variant.size],
        color: i.variant.color,
        barcode: i.variant.barcode,
        imagePath: i.variant.imagePath,
      })),
    };
  }

  return {
    async loadVariantPrices(variantIds, tx) {
      const rows = await tx.variant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, priceCents: true },
      });
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.id, r.priceCents);
      return map;
    },

    async variantsExistAndActive(variantIds, tx) {
      if (variantIds.length === 0) return new Set();
      const rows = await tx.variant.findMany({
        where: { id: { in: variantIds }, deletedAt: null, isActive: true },
        select: { id: true },
      });
      return new Set(rows.map((r) => r.id));
    },

    async loadStockForVariants(storeId, variantIds, tx) {
      const rows = await tx.stockBySite.findMany({
        where: { storeId, variantId: { in: variantIds } },
        select: { variantId: true, quantity: true },
      });
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.variantId, r.quantity);
      return map;
    },

    async decrementStock(storeId, variantId, qty, tx) {
      const updated = await tx.stockBySite.update({
        where: { variantId_storeId: { variantId, storeId } },
        data: { quantity: { decrement: qty } },
        select: { quantity: true },
      });
      return updated.quantity;
    },

    async createMovement(input, tx) {
      await tx.stockMovement.create({
        data: {
          storeId: input.storeId,
          variantId: input.variantId,
          userId: input.userId,
          type: 'sale_out',
          payload: input.payload as Prisma.InputJsonValue,
        },
      });
    },

    async createSale(header, items, tx) {
      const created = await tx.sale.create({
        data: {
          storeId: header.storeId,
          recordedByUserId: header.recordedByUserId,
          paymentMethod: PM_TO_PRISMA[header.paymentMethod],
          totalCents: header.totalCents,
          items: { create: items },
        },
        select: { id: true },
      });
      return { id: created.id };
    },

    async findSale(saleId) {
      return loadSale(db, saleId);
    },

    async list(storeId, query) {
      const skip = (query.page - 1) * query.pageSize;
      const [rows, total] = await Promise.all([
        db.sale.findMany({
          where: { storeId },
          include: {
            store: { select: { name: true } },
            user: { select: { fullName: true } },
            items: { include: { variant: { include: { product: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.pageSize,
        }),
        db.sale.count({ where: { storeId } }),
      ]);
      return {
        items: rows.map((r) => ({
          id: r.id,
          storeId: r.storeId,
          storeName: r.store.name,
          recordedByUserId: r.recordedByUserId,
          recordedByFullName: r.user.fullName,
          paymentMethod: PM_FROM_PRISMA[r.paymentMethod],
          totalCents: r.totalCents,
          itemCount: r.items.length,
          totalUnits: r.items.reduce((s, i) => s + i.quantity, 0),
          createdAt: r.createdAt.toISOString(),
          items: r.items.map((i) => ({
            id: i.id,
            variantId: i.variantId,
            quantity: i.quantity,
            priceAtSaleCents: i.priceAtSaleCents,
            subtotalCents: i.subtotalCents,
            productId: i.variant.productId,
            productCode: i.variant.product.code,
            productName: i.variant.product.name,
            size: SIZE_FROM_PRISMA[i.variant.size],
            color: i.variant.color,
            barcode: i.variant.barcode,
            imagePath: i.variant.imagePath,
          })),
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async buildDashboard(storeId, now) {
      // Today is still runtime (not yet closed). Everything ≤ yesterday is read
      // from DailyReport (the immutable cierre snapshot), per the agreed model.
      const startToday = startOfDayLocal(now);
      const todayKey = isoLocalDate(now);
      const startWeek = startOfWeekMonday(now);
      const startFourWeeksAgo = new Date(startWeek.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
      const startTwentyEightDaysAgo = new Date(startToday.getTime() - 34 * 24 * 60 * 60 * 1000);
      const dateOnlyAt = (d: Date) => new Date(`${isoLocalDate(d)}T00:00:00.000Z`);

      // Today's runtime aggregate from sales.
      const todaySales = await db.sale.findMany({
        where: { storeId, createdAt: { gte: startToday } },
        select: { paymentMethod: true, totalCents: true },
      });
      let todayCents = 0;
      let todayQr = 0;
      let todayCard = 0;
      let todayCash = 0;
      const todayCount = todaySales.length;
      for (const s of todaySales) {
        todayCents += s.totalCents;
        const pm = PM_FROM_PRISMA[s.paymentMethod];
        if (pm === 'qr') todayQr += s.totalCents;
        else if (pm === 'card') todayCard += s.totalCents;
        else todayCash += s.totalCents;
      }

      // Closed reports for the last 28 days (covers 4 weekly buckets + last5).
      const closedReports = await db.dailyReport.findMany({
        where: {
          storeId,
          date: {
            gte: dateOnlyAt(startTwentyEightDaysAgo),
            lt: dateOnlyAt(now), // strictly before today
          },
        },
        select: {
          date: true,
          totalCents: true,
          qrCents: true,
          cardCents: true,
          cashCents: true,
          transactionsCount: true,
        },
      });

      const dayMap = new Map<string, { qr: number; card: number; cash: number; total: number; count: number }>();
      for (const r of closedReports) {
        const key = r.date.toISOString().slice(0, 10);
        dayMap.set(key, {
          qr: r.qrCents,
          card: r.cardCents,
          cash: r.cashCents,
          total: r.totalCents,
          count: r.transactionsCount,
        });
      }
      // Add today (runtime).
      dayMap.set(todayKey, {
        qr: todayQr,
        card: todayCard,
        cash: todayCash,
        total: todayCents,
        count: todayCount,
      });

      const yesterdayKey = isoLocalDate(new Date(startToday.getTime() - 24 * 60 * 60 * 1000));
      const yesterdayCents = dayMap.get(yesterdayKey)?.total ?? 0;

      // 7-day series (oldest → newest), zero-filled.
      const startSevenDaysAgo = new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000);
      const last7Days: Array<{ date: string; totalCents: number }> = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(startSevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const key = isoLocalDate(d);
        last7Days.push({ date: key, totalCents: dayMap.get(key)?.total ?? 0 });
      }

      // Daily breakdown — last 5 days, newest first.
      const dailyBreakdown = [];
      for (let i = 0; i < 5; i += 1) {
        const d = new Date(startToday.getTime() - i * 24 * 60 * 60 * 1000);
        const key = isoLocalDate(d);
        const b = dayMap.get(key) ?? { qr: 0, card: 0, cash: 0, total: 0, count: 0 };
        dailyBreakdown.push({
          date: key,
          qrCents: b.qr,
          cardCents: b.card,
          cashCents: b.cash,
          totalCents: b.total,
        });
      }

      // Weekly breakdown — last 5 weeks (Mon→Sun), newest first.
      const weeklyBreakdown = [];
      let weekCents = 0;
      let weekCount = 0;
      for (let i = 0; i < 5; i += 1) {
        const ws = new Date(startWeek.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const we = new Date(ws.getTime() + 6 * 24 * 60 * 60 * 1000);
        let qr = 0;
        let card = 0;
        let cash = 0;
        let total = 0;
        let count = 0;
        for (let d = 0; d < 7; d += 1) {
          const dDate = new Date(ws.getTime() + d * 24 * 60 * 60 * 1000);
          const key = isoLocalDate(dDate);
          const b = dayMap.get(key);
          if (!b) continue;
          qr += b.qr;
          card += b.card;
          cash += b.cash;
          total += b.total;
          count += b.count;
        }
        weeklyBreakdown.push({
          weekStart: isoLocalDate(ws),
          weekEnd: isoLocalDate(we),
          qrCents: qr,
          cardCents: card,
          cashCents: cash,
          totalCents: total,
        });
        if (i === 0) {
          weekCents = total;
          weekCount = count;
        }
      }

      // Suppress unused warning: startFourWeeksAgo is conceptually the window;
      // implementation derives it via the per-week loop instead.
      void startFourWeeksAgo;

      const deltaPct =
        yesterdayCents === 0
          ? null
          : ((todayCents - yesterdayCents) / yesterdayCents) * 100;

      const averageTicketCents = weekCount === 0 ? 0 : Math.round(weekCents / weekCount);

      return {
        todayCents,
        yesterdayCents,
        deltaPct,
        weekCents,
        transactionsCount: weekCount,
        averageTicketCents,
        last7Days,
        dailyBreakdown,
        weeklyBreakdown,
      };
    },

    async runSerializable(fn) {
      return db.$transaction((tx) => fn(tx as SaleTx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  };
}
