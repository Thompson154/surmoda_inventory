import { z } from 'zod';

/**
 * Body for POST /api/v1/inventory-snapshots (manual trigger).
 * storeId is optional — when omitted, all active stores are snapshotted.
 * We validate as a non-empty string (the DB uses cuid() not uuid() but any
 * non-empty string ID is valid for lookup — Prisma will 404 at runtime if
 * the store doesn't exist).
 */
export const TriggerSnapshotBodySchema = z.object({
  storeId: z.string().min(1).optional(),
});

export type TriggerSnapshotBody = z.infer<typeof TriggerSnapshotBodySchema>;
