# Module: `auditing`

## Responsibility

Two halves of the same domain:

- **Write side** (`service.ts`) — fire-and-forget recording of every domain
  mutation. Constitution PARTE VI § 6.2: audit MUST NOT add measurable latency.
- **Read side** (`repository.ts` + `queryService.ts`) — paginated audit log
  viewer for admin / encargada (module 12).

## Write contract

Anywhere a controller wants to record an event:

```ts
import { emitAudit } from '../../middleware/auditLogger';

emitAudit(req, {
  userId: auth.userId,
  action: 'SALE_CREATED',
  entity: 'Sale',
  entityId: sale.id,
  payload: { storeId, totalCents, paymentMethod },
});
```

`emitAudit` is fire-and-forget via `setImmediate`. The audit row is written
AFTER the response has been flushed; failures are logged with
`logger.error` and never bubble. **No part of the request lifecycle blocks
on audit.**

## Read contract

`GET /api/v1/audit-logs?userId&storeId&page&pageSize` — admin or any
encargada. Two filters supported per locked decision Q4:

- `userId` — exact match on `auditLog.userId`.
- `storeId` — matches `payload.storeId`, `payload.toStoreId`,
  `payload.fromStoreId`, OR `entity='Store' AND entityId=storeId`. Backed
  by the GIN-jsonb_path_ops index (migration 013).

Page size capped at 200; default 50.

## Defense in depth

`sanitize.ts` walks every payload before persistence and redacts any key
matching the secret denylist (`password*`, `*token`, `*secret`, `apikey`,
`authorization`, `cookie`, `jwt`, `session`). Even if a future contributor
accidentally puts a refresh token in the payload, `audit_logs` never sees
the plaintext. Recursive through nested objects and arrays. Idempotent.

## Invariants

1. **`emitAudit` MUST NOT throw.** Audit failures get logged, never propagated.
2. **`payload` is JSON.** Don't store binary blobs or large strings; the
   fields are intended for "what changed at a glance".
3. **PII handling**: IP and user-agent are stored in plaintext. Decision
   Q5 (locked) — internal B2B tool, full visibility for admin/encargada is
   acceptable. Mask at viewer level if regulation later changes.
4. **Retention**: opt-in via `AUDIT_RETENTION_DAYS` env (`0` = disabled).
   Production recommendation: 365 days. Cron in
   `apps/api/src/jobs/auditRetention.ts`.

## Tests

- Unit: `__tests__/sanitize.spec.ts` (7 cases — every redaction class +
  recursion + non-mutation contract).
- Integration: `tests/integration/auditLogs.spec.ts` (5 cases — admin OK,
  encargada OK, vendedora 403, anon 401, pageSize cap 400).

## Related

- `middleware/auditLogger.ts` — request-aware emit helper that injects IP +
  user-agent.
- `jobs/auditRetention.ts` — daily TTL deletion cron.
- Migration `20260426060000_013_audit_log_payload_gin` — GIN index for
  store-filter queries.
