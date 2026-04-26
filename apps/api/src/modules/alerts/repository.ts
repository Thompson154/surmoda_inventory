// Operational alerts — runtime queries, no dedicated table.
//
// Three signals:
//   - STOCK_LOW       → stockBySite.quantity > 0 AND ≤ LOW_THRESHOLD
//   - STOCK_OUT_HOT   → stockBySite.quantity = 0 AND the variant sold in the last 7 days
//   - CIERRE_MISSING  → active store had sales yesterday OR earlier and yesterday has no DailyReport

import type { AlertDTO, AlertKind, AlertsResponse } from '@surmoda/contracts';
import type { Database } from '../../infrastructure/database';
import {
  boliviaDayKey,
  boliviaDayWindow,
  isoDateBolivia,
  previousBoliviaDayKey,
} from '../../shared/datetime/bolivia';
import { SIZE_FROM_PRISMA } from '../../shared/enums/mappings';

const LOW_STOCK_THRESHOLD = 5;
const HOT_LOOKBACK_DAYS = 7;
const ALERT_LIMIT_PER_KIND = 25;

export interface AlertsRepository {
  buildAlerts(): Promise<AlertsResponse>;
}

export function buildAlertsRepository(db: Database): AlertsRepository {
  return {
    async buildAlerts() {
      const now = new Date();
      const detectedAt = now.toISOString();
      const yesterdayKey = previousBoliviaDayKey(now);
      const sevenDaysAgo = new Date(
        boliviaDayKey(now).getTime() - HOT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      );
      const { start: hotStart } = boliviaDayWindow(sevenDaysAgo);

      // ── 1. STOCK_LOW + STOCK_OUT_HOT come from a single stockBySite scan ──
      const stockRows = await db.stockBySite.findMany({
        where: {
          quantity: { lte: LOW_STOCK_THRESHOLD },
          variant: {
            deletedAt: null,
            isActive: true,
            product: { deletedAt: null, isActive: true },
          },
          store: { isActive: true, deletedAt: null },
        },
        include: {
          store: { select: { id: true, name: true } },
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

      const lowAlerts: AlertDTO[] = [];
      const zeroVariantPairs: Array<{
        storeId: string;
        variantId: string;
        storeName: string;
        variant: (typeof stockRows)[number]['variant'];
      }> = [];
      for (const r of stockRows) {
        if (r.quantity > 0) {
          lowAlerts.push({
            id: `STOCK_LOW:${r.storeId}:${r.variantId}`,
            kind: 'STOCK_LOW',
            severity: 'warning',
            message: `Stock bajo en ${r.store.name}: ${r.variant.product.code} · ${SIZE_FROM_PRISMA[r.variant.size]} · ${r.variant.color} (${r.quantity} u.)`,
            link: `/sedes/${r.storeId}/inventario`,
            detectedAt,
            meta: {
              storeId: r.storeId,
              variantId: r.variantId,
              productCode: r.variant.product.code,
              quantity: r.quantity,
            },
          });
        } else {
          zeroVariantPairs.push({
            storeId: r.storeId,
            variantId: r.variantId,
            storeName: r.store.name,
            variant: r.variant,
          });
        }
      }

      // STOCK_OUT_HOT — only flag a zero-stock variant if it actually sold recently.
      // Pull every saleItem in the lookback window joined to its sale's store and
      // build a Set of "storeId:variantId" pairs. Then intersect with zero rows.
      const hotAlerts: AlertDTO[] = [];
      if (zeroVariantPairs.length > 0) {
        const recentItems = await db.saleItem.findMany({
          where: { sale: { createdAt: { gte: hotStart } } },
          select: { variantId: true, sale: { select: { storeId: true } } },
        });
        const hotPairs = new Set<string>();
        for (const it of recentItems) hotPairs.add(`${it.sale.storeId}:${it.variantId}`);
        for (const z of zeroVariantPairs) {
          if (!hotPairs.has(`${z.storeId}:${z.variantId}`)) continue;
          hotAlerts.push({
            id: `STOCK_OUT_HOT:${z.storeId}:${z.variantId}`,
            kind: 'STOCK_OUT_HOT',
            severity: 'critical',
            message: `Sin stock con rotación: ${z.variant.product.code} · ${SIZE_FROM_PRISMA[z.variant.size]} · ${z.variant.color} en ${z.storeName} (vendió en últimos ${HOT_LOOKBACK_DAYS} días)`,
            link: `/sedes/${z.storeId}/inventario`,
            detectedAt,
            meta: {
              storeId: z.storeId,
              variantId: z.variantId,
              productCode: z.variant.product.code,
            },
          });
        }
      }

      // ── 2. CIERRE_MISSING — active stores with sales yesterday but no report ──
      const activeStores = await db.store.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true },
      });
      const yWindow = boliviaDayWindow(yesterdayKey);
      const closedYesterday = await db.dailyReport.findMany({
        where: { date: yesterdayKey },
        select: { storeId: true },
      });
      const closedSet = new Set(closedYesterday.map((r) => r.storeId));
      const cierreAlerts: AlertDTO[] = [];
      for (const s of activeStores) {
        if (closedSet.has(s.id)) continue;
        // Only flag stores that actually had any sale yesterday — empty days
        // are valid (closed branch, holiday). Cheap exists-check.
        const sample = await db.sale.findFirst({
          where: { storeId: s.id, createdAt: { gte: yWindow.start, lt: yWindow.end } },
          select: { id: true },
        });
        if (!sample) continue;
        cierreAlerts.push({
          id: `CIERRE_MISSING:${s.id}:${isoDateBolivia(yesterdayKey)}`,
          kind: 'CIERRE_MISSING',
          severity: 'warning',
          message: `${s.name}: cierre de ${isoDateBolivia(yesterdayKey)} no fue registrado.`,
          link: `/sedes/${s.id}/ventas`,
          detectedAt,
          meta: { storeId: s.id, date: isoDateBolivia(yesterdayKey) },
        });
      }

      // Cap each kind so a runaway state doesn't ship 5k entries to the client.
      const cap = <T>(arr: T[]): T[] => arr.slice(0, ALERT_LIMIT_PER_KIND);
      const items: AlertDTO[] = [
        ...cap(cierreAlerts), // cierre first — highest operational urgency
        ...cap(hotAlerts),
        ...cap(lowAlerts),
      ];
      const countsByKind: Record<AlertKind, number> = {
        STOCK_LOW: lowAlerts.length,
        STOCK_OUT_HOT: hotAlerts.length,
        CIERRE_MISSING: cierreAlerts.length,
      };
      return { items, countsByKind };
    },
  };
}
