// Integration smoke test — verifies migration 019 applied correctly.
// Checks: sale_items has total_cents, return_requests table exists with expected columns.
// RED phase: written before migration exists.

import { getPrisma, disconnectPrisma } from '../../src/infrastructure/database';

const db = getPrisma();

afterAll(async () => {
  await disconnectPrisma();
});

describe('Migration 019 — sale_items and return_requests schema', () => {
  describe('sale_items table', () => {
    it('has total_cents column', async () => {
      const rows = await db.$queryRaw<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'sale_items'
        AND column_name = 'total_cents'
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.column_name).toBe('total_cents');
    });

    it('has subtotal_cents column', async () => {
      const rows = await db.$queryRaw<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'sale_items'
        AND column_name = 'subtotal_cents'
      `;
      expect(rows).toHaveLength(1);
    });

    it('has price_at_sale_cents column (per-unit price snapshot)', async () => {
      const rows = await db.$queryRaw<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'sale_items'
        AND column_name = 'price_at_sale_cents'
      `;
      expect(rows).toHaveLength(1);
    });
  });

  describe('return_requests table', () => {
    it('exists', async () => {
      const rows = await db.$queryRaw<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name = 'return_requests'
        AND table_schema = 'public'
      `;
      expect(rows).toHaveLength(1);
    });

    it('has expected columns', async () => {
      const rows = await db.$queryRaw<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'return_requests'
        ORDER BY ordinal_position
      `;
      const cols = rows.map((r) => r.column_name);
      expect(cols).toContain('id');
      expect(cols).toContain('requester_id');
      expect(cols).toContain('store_id');
      expect(cols).toContain('status');
      expect(cols).toContain('returned_variant_id');
      expect(cols).toContain('returned_quantity');
      expect(cols).toContain('sale_date');
      expect(cols).toContain('exchange_variant_id');
      expect(cols).toContain('reason');
      expect(cols).toContain('reviewed_by');
      expect(cols).toContain('reviewed_at');
      expect(cols).toContain('rejection_reason');
      expect(cols).toContain('created_at');
    });

    it('status column has integer or text type (enum backed by text in Postgres)', async () => {
      const rows = await db.$queryRaw<{ data_type: string; udt_name: string }[]>`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'return_requests'
        AND column_name = 'status'
      `;
      expect(rows).toHaveLength(1);
      // WHY: Prisma maps enums to USER-DEFINED type in pg information_schema.
      expect(['USER-DEFINED', 'text']).toContain(rows[0]?.data_type);
    });

    it('has index on (store_id, status)', async () => {
      const rows = await db.$queryRaw<{ indexname: string }[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'return_requests'
        AND indexdef LIKE '%store_id%status%'
      `;
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
