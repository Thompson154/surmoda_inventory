import {
  Prisma,
  type PaymentMethod as PrismaPaymentMethod,
  type Size as PrismaSize,
} from '@prisma/client';
import type { Database } from '../../infrastructure/database';
import type { Size } from '@surmoda/contracts';
import type {
  ListSalesQuery,
  PaginatedSales,
  PaymentMethod,
  SaleWithItems,
  SalesDashboard,
} from './types';

export type SaleTx = Prisma.TransactionClient;

const SIZE_FROM_PRISMA: Record<PrismaSize, Size> = {
  s: 's', m: 'm', l: 'l', xl: 'xl', xxl: 'xxl',
  size_28: '28', size_30: '30', size_32: '32', size_34: '34', standard: 'standard',
};

const PM_FROM_PRISMA: Record<PrismaPaymentMethod, PaymentMethod> = {
  qr: 'qr', card: 'card', cash: 'cash',
};

const PM_TO_PRISMA: Record<PaymentMethod, PrismaPaymentMethod> = {
  qr: 'qr', card: 'card', cash: 'cash',
};

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

// Bolivia is UTC-4. Day boundaries computed in store-local timezone.
const TZ_OFFSET_MS = 4 * 60 * 60 * 1000;

function startOfDayLocal(date: Date): Date {
  const local = new Date(date.getTime() - TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + TZ_OFFSET_MS);
}

function isoLocalDate(date: Date): string {
  // YYYY-MM-DD in Bolivia local time.
  const local = new Date(date.getTime() - TZ_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

function startOfWeekMonday(date: Date): Date {
  const sod = startOfDayLocal(date);
  const local = new Date(sod.getTime() - TZ_OFFSET_MS);
  const dow = local.getUTCDay(); // 0=Sun..6=Sat
  const diff = (dow === 0 ? -6 : 1 - dow); // Monday-anchored
  local.setUTCDate(local.getUTCDate() + diff);
  return new Date(local.getTime() + TZ_OFFSET_MS);
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
            items: { select: { quantity: true } },
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
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async buildDashboard(storeId, now) {
      const startToday = startOfDayLocal(now);
      const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
      // 7-day window for the chart (oldest day first).
      const startSevenDaysAgo = new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000);
      const startWeek = startOfWeekMonday(now);
      const startFourWeeksAgo = new Date(startWeek.getTime() - 3 * 7 * 24 * 60 * 60 * 1000);

      const sales = await db.sale.findMany({
        where: { storeId, createdAt: { gte: startFourWeeksAgo } },
        select: { paymentMethod: true, totalCents: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      let todayCents = 0;
      let yesterdayCents = 0;
      let weekCents = 0;
      let weekCount = 0;
      const dayMap = new Map<string, { qr: number; card: number; cash: number; total: number }>();
      const weekMap = new Map<string, { qr: number; card: number; cash: number; total: number; weekStart: Date }>();

      for (const s of sales) {
        const day = isoLocalDate(s.createdAt);
        const totalC = s.totalCents;

        if (s.createdAt >= startToday) todayCents += totalC;
        else if (s.createdAt >= startYesterday) yesterdayCents += totalC;

        if (s.createdAt >= startWeek) {
          weekCents += totalC;
          weekCount += 1;
        }

        const dayBucket = dayMap.get(day) ?? { qr: 0, card: 0, cash: 0, total: 0 };
        const bucket = { ...dayBucket };
        const pm = PM_FROM_PRISMA[s.paymentMethod];
        if (pm === 'qr') bucket.qr += totalC;
        else if (pm === 'card') bucket.card += totalC;
        else bucket.cash += totalC;
        bucket.total += totalC;
        dayMap.set(day, bucket);

        const weekStart = startOfWeekMonday(s.createdAt);
        const weekKey = isoLocalDate(weekStart);
        const wbDefault = { qr: 0, card: 0, cash: 0, total: 0, weekStart };
        const wb = { ...(weekMap.get(weekKey) ?? wbDefault) };
        if (pm === 'qr') wb.qr += totalC;
        else if (pm === 'card') wb.card += totalC;
        else wb.cash += totalC;
        wb.total += totalC;
        weekMap.set(weekKey, wb);
      }

      // 7-day series (oldest → newest), zero-filled.
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
        const b = dayMap.get(key) ?? { qr: 0, card: 0, cash: 0, total: 0 };
        dailyBreakdown.push({
          date: key,
          qrCents: b.qr,
          cardCents: b.card,
          cashCents: b.cash,
          totalCents: b.total,
        });
      }

      // Weekly breakdown — last 4 weeks, newest first.
      const weeklyBreakdown = [];
      for (let i = 0; i < 4; i += 1) {
        const ws = new Date(startWeek.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const we = new Date(ws.getTime() + 6 * 24 * 60 * 60 * 1000);
        const key = isoLocalDate(ws);
        const b = weekMap.get(key) ?? { qr: 0, card: 0, cash: 0, total: 0 };
        weeklyBreakdown.push({
          weekStart: key,
          weekEnd: isoLocalDate(we),
          qrCents: b.qr,
          cardCents: b.card,
          cashCents: b.cash,
          totalCents: b.total,
        });
      }

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
