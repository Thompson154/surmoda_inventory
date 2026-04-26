// Cross-store analytics repository.
//
// Strategy:
//   - For every day in [from, to-1] we read from `daily_reports` (immutable
//     snapshot, fast).
//   - For "today" (Bolivia local) we aggregate on the fly from `sales` because
//     the day hasn't been closed yet.
//   - Top products / top sellers always come from raw `sale_items` / `sales`
//     joined to variants, because DailyReport doesn't keep per-product detail.

import type { Database } from '../../infrastructure/database';
import {
  boliviaDayKey,
  boliviaDayWindow,
  isoDateBolivia,
  parseBoliviaDayKey,
} from '../../shared/datetime/bolivia';
import { PM_FROM_PRISMA, SIZE_FROM_PRISMA } from '../../shared/enums/mappings';
import type {
  ReportStoreRowDTO,
  ReportSummaryDTO,
  ReportTopProductDTO,
  ReportTopSellerDTO,
  ReportTotalsDTO,
} from '@surmoda/contracts';

const TOP_PRODUCTS_LIMIT = 10;
const TOP_SELLERS_LIMIT = 5;

export interface ReportRepository {
  buildSummary(from: string, to: string): Promise<ReportSummaryDTO>;
}

export function buildReportRepository(db: Database): ReportRepository {
  return {
    async buildSummary(from, to) {
      const fromKey = parseBoliviaDayKey(from);
      const toKey = parseBoliviaDayKey(to);
      const todayKey = boliviaDayKey(new Date());
      const todayIso = isoDateBolivia(new Date());

      const todayInRange = todayKey >= fromKey && todayKey <= toKey;
      // Past-portion of the range = everything strictly before today.
      const closedTo = todayInRange
        ? new Date(todayKey.getTime() - 24 * 60 * 60 * 1000)
        : toKey;
      const hasClosedRange = closedTo >= fromKey;

      // ── 1. Closed days from DailyReport ────────────────────────────────────
      const closedRows = hasClosedRange
        ? await db.dailyReport.findMany({
            where: {
              date: { gte: fromKey, lte: closedTo },
            },
            select: {
              storeId: true,
              totalCents: true,
              qrCents: true,
              cardCents: true,
              cashCents: true,
              transactionsCount: true,
              itemCount: true,
              store: { select: { name: true, code: true } },
            },
          })
        : [];

      // ── 2. Runtime aggregate for "today" if the range includes it ─────────
      type RuntimeBucket = {
        totalCents: number;
        qrCents: number;
        cardCents: number;
        cashCents: number;
        transactionsCount: number;
        itemCount: number;
        storeName: string;
        storeCode: string;
      };
      const runtimeByStore = new Map<string, RuntimeBucket>();
      if (todayInRange) {
        const { start, end } = boliviaDayWindow(todayKey);
        const todaySales = await db.sale.findMany({
          where: { createdAt: { gte: start, lt: end } },
          select: {
            storeId: true,
            paymentMethod: true,
            totalCents: true,
            store: { select: { name: true, code: true } },
            items: { select: { quantity: true } },
          },
        });
        for (const s of todaySales) {
          const key = s.storeId;
          const bucket =
            runtimeByStore.get(key) ??
            {
              totalCents: 0,
              qrCents: 0,
              cardCents: 0,
              cashCents: 0,
              transactionsCount: 0,
              itemCount: 0,
              storeName: s.store.name,
              storeCode: s.store.code,
            };
          bucket.totalCents += s.totalCents;
          bucket.transactionsCount += 1;
          bucket.itemCount += s.items.reduce((a, b) => a + b.quantity, 0);
          const pm = PM_FROM_PRISMA[s.paymentMethod];
          if (pm === 'qr') bucket.qrCents += s.totalCents;
          else if (pm === 'card') bucket.cardCents += s.totalCents;
          else bucket.cashCents += s.totalCents;
          runtimeByStore.set(key, bucket);
        }
      }

      // ── 3. Combine totals + per-store rows ────────────────────────────────
      const totals: ReportTotalsDTO = {
        totalCents: 0,
        qrCents: 0,
        cardCents: 0,
        cashCents: 0,
        transactionsCount: 0,
        itemCount: 0,
        averageTicketCents: 0,
        discountCents: 0,
      };
      const byStoreMap = new Map<string, ReportStoreRowDTO>();

      for (const r of closedRows) {
        totals.totalCents += r.totalCents;
        totals.qrCents += r.qrCents;
        totals.cardCents += r.cardCents;
        totals.cashCents += r.cashCents;
        totals.transactionsCount += r.transactionsCount;
        totals.itemCount += r.itemCount;

        const existing = byStoreMap.get(r.storeId);
        if (existing) {
          existing.totalCents += r.totalCents;
          existing.transactionsCount += r.transactionsCount;
        } else {
          byStoreMap.set(r.storeId, {
            storeId: r.storeId,
            storeName: r.store.name,
            storeCode: r.store.code,
            totalCents: r.totalCents,
            transactionsCount: r.transactionsCount,
          });
        }
      }
      for (const [storeId, b] of runtimeByStore.entries()) {
        totals.totalCents += b.totalCents;
        totals.qrCents += b.qrCents;
        totals.cardCents += b.cardCents;
        totals.cashCents += b.cashCents;
        totals.transactionsCount += b.transactionsCount;
        totals.itemCount += b.itemCount;

        const existing = byStoreMap.get(storeId);
        if (existing) {
          existing.totalCents += b.totalCents;
          existing.transactionsCount += b.transactionsCount;
        } else {
          byStoreMap.set(storeId, {
            storeId,
            storeName: b.storeName,
            storeCode: b.storeCode,
            totalCents: b.totalCents,
            transactionsCount: b.transactionsCount,
          });
        }
      }
      totals.averageTicketCents =
        totals.transactionsCount === 0
          ? 0
          : Math.round(totals.totalCents / totals.transactionsCount);

      // ── 4. Top products (always from raw sale_items in the date window) ──
      const { start: rangeStart } = boliviaDayWindow(fromKey);
      const { end: rangeEnd } = boliviaDayWindow(toKey);
      const itemRows = await db.saleItem.findMany({
        where: {
          sale: { createdAt: { gte: rangeStart, lt: rangeEnd } },
        },
        include: {
          variant: {
            select: {
              id: true,
              size: true,
              color: true,
              product: { select: { code: true, name: true } },
            },
          },
        },
      });
      const productAgg = new Map<string, ReportTopProductDTO>();
      let discountCents = 0;
      for (const it of itemRows) {
        // Discount per line = (catalog price * qty) - what was actually charged.
        // Negative-protected: if for any reason subtotal > priceAtSale*qty we
        // ignore the surplus rather than reporting a negative "discount".
        const lineCatalog = it.priceAtSaleCents * it.quantity;
        if (lineCatalog > it.subtotalCents) {
          discountCents += lineCatalog - it.subtotalCents;
        }
        const key = it.variantId;
        const lineTotal = it.subtotalCents;
        const existing = productAgg.get(key);
        if (existing) {
          existing.quantitySold += it.quantity;
          existing.totalCents += lineTotal;
        } else {
          productAgg.set(key, {
            variantId: it.variantId,
            productCode: it.variant.product.code,
            productName: it.variant.product.name,
            size: SIZE_FROM_PRISMA[it.variant.size],
            color: it.variant.color,
            quantitySold: it.quantity,
            totalCents: lineTotal,
          });
        }
      }
      const topProducts = Array.from(productAgg.values())
        .sort((a, b) => b.totalCents - a.totalCents)
        .slice(0, TOP_PRODUCTS_LIMIT);
      totals.discountCents = discountCents;

      // ── 5. Top sellers (sales they recorded in the date window) ──────────
      const sellerRows = await db.sale.findMany({
        where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
        select: {
          recordedByUserId: true,
          totalCents: true,
          user: { select: { fullName: true } },
        },
      });
      const sellerAgg = new Map<string, ReportTopSellerDTO>();
      for (const s of sellerRows) {
        const key = s.recordedByUserId;
        const existing = sellerAgg.get(key);
        if (existing) {
          existing.transactionsCount += 1;
          existing.totalCents += s.totalCents;
        } else {
          sellerAgg.set(key, {
            userId: key,
            fullName: s.user.fullName,
            transactionsCount: 1,
            totalCents: s.totalCents,
          });
        }
      }
      const topSellers = Array.from(sellerAgg.values())
        .sort((a, b) => b.totalCents - a.totalCents)
        .slice(0, TOP_SELLERS_LIMIT);

      const byStore = Array.from(byStoreMap.values()).sort(
        (a, b) => b.totalCents - a.totalCents,
      );

      // Suppress unused warning when range entirely in the past.
      void todayIso;

      return {
        range: { from, to },
        totals,
        byStore,
        topProducts,
        topSellers,
      };
    },
  };
}
