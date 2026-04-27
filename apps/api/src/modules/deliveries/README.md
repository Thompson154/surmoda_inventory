# Module: `deliveries`

## Responsibility

Atomic stock movement between two stores along a **lifecycle state machine**:

```
draft → sent → received | partial         (distribution)
                received                   (reception / warehouse intake)
```

Three real-world flows ride on this single domain:

1. **Reception (warehouse intake)** — supplier → almacén; born `received`.
2. **Distribution** — almacén → sucursal; legacy default for `Nueva entrega`
   from the branch's UI.
3. **Lateral transfer / return (module 11)** — sucursal A → sucursal B, or
   sucursal → almacén; encargada-of-origin authorizes per locked decision Q1=A.

## Stock timing — locked decision Q2-D

**Origin debit happens at SENT. Destination credit at RECEIVED.** This holds the
constitution's perpetual-inventory invariant (rule #4) — at no point does any
store show fictitious stock. Lines where `receivedQuantity < sentQuantity` stay
out of both stocks; the gap is captured in `delivery_received_adjusted`
movements for later admin reconciliation.

Implemented in `stockOps.ts`:

- `applyOriginDebit(repo, args, tx)` — at draft→sent (or born-sent on create).
- `applyDestinationCredit(repo, args, tx)` — at sent→received|partial (or
  born-received on intake).

## Public surface

- `POST /api/v1/stores/:toStoreId/deliveries` — create. Body accepts optional
  `fromStoreId` (module 11) and `asDraft` (start in draft).
- `PATCH /api/v1/deliveries/:id/draft` — edit draft (encargada/admin only).
- `POST /api/v1/deliveries/:id/confirm` — draft → sent (debits origin).
- `POST /api/v1/deliveries/:id/receive` — sent → received|partial (credits
  destination, by actual quantities).
- `POST /api/v1/stores/:warehouseId/deliveries/intake` — warehouse-only intake
  with on-the-fly product/variant creation (feature 013).
- `GET  /api/v1/stores/:storeId/deliveries?direction=incoming|outgoing|both` —
  module 11 surfaces both sides.
- `GET  /api/v1/stores/:storeId/deliveries/grouped` — UI summary grouped by
  product code.

## Invariants

1. **Every state transition runs in a `Prisma.$transaction` with Serializable
   isolation.** Any new transition (or any change to stock movement) MUST go
   through `deliveries.runSerializable`.
2. **Authorization order:**
   - Reception (warehouse): admin / encargada anywhere; vendedora forbidden.
   - Distribution (warehouse → branch): same.
   - Lateral transfer: encargada of the **origin** (or admin). This is checked
     against the explicit `fromStoreId` in `service.create`.
3. **Insufficient stock at SENT throws 409 `DELIVERY_INSUFFICIENT_STOCK`.** The
   encargada catches it before the truck leaves. Re-validation at confirm time
   is mandatory because draft items can age while warehouse stock drains.
4. **Vendedora cannot inflate `receivedQuantity` above `quantity`.** That requires
   an admin manual stock adjustment via `inventory` module.

## Tests

- Integration: `tests/integration/deliveries.spec.ts` — 22 cases covering
  reception, distribution (born-sent + draft→confirm→receive), partial
  reception with audit, RBAC matrix, and the module-11 lateral transfer happy
  path + edge cases (origin=destination 400, unknown origin 404, vendedora
  blocked, draft-stale insufficient-stock at confirm).

## Related

- `apps/api/prisma/schema.prisma` — `Delivery`, `DeliveryItem`,
  `DeliveryItemAdjustment`, `StockBySite`, `StockMovement`.
- Audit emit sites: `controller.ts` — `DELIVERY_CREATED`,
  `DELIVERY_DRAFT_UPDATED`, `DELIVERY_CONFIRMED`, `DELIVERY_RECEIVED`,
  `DELIVERY_RECEIVED_PARTIAL`.
