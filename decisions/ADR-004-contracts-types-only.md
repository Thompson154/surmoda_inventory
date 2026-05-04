# ADR-004 — `@surmoda/contracts` como TypeScript types-only (sin Zod compartido)

- **Estado**: Aceptado
- **Fecha**: 2026-05-01
- **Autores**: Adrian Thompson
- **Versión constitución**: v1.0.1

## Contexto

El monorepo expone un package compartido `@surmoda/contracts` (en `packages/contracts/`) que actualmente exporta:

- Interfaces TypeScript de DTOs (`CreateSaleDTO`, `SaleResponse`, `Product`, etc.)
- Constantes de dominio (`StockMovementType`, `PaymentMethod`, `Roles`)
- Códigos de error (`ERROR_CODES`)

**No** exporta schemas Zod compartidos. El backend valida cada request con Zod en `apps/api/src/modules/<dominio>/validators.ts`. El frontend re-implementa shapes manualmente en cada `services/*.ts` o asume que TypeScript compile-time es suficiente.

El audit Wave 4 del 2026-05-01 detectó esto como hot spot futuro: si el FE construye un payload mal-formed (campo opcional faltante, enum con valor extra), el BE responde 400 pero la UX es mala — el usuario ve "Validation error" sin saber qué campo. Con Zod compartido, el FE podría validar antes de mandar y dar feedback granular.

## Decisión

**Mantener `@surmoda/contracts` como types-only** (TypeScript interfaces y constantes, sin runtime Zod) hasta post-deploy. La sincronización FE↔BE se cerrará vía OpenAPI generado desde Zod del backend (Quick Win #3 del audit), consumido por `openapi-typescript` en FE — no agregando Zod al bundle del frontend.

## Alternativas consideradas

### Opción A — Mover Zod a contracts

El package exporta `CreateSaleSchema` y FE usa el mismo schema para validar formularios pre-submit. **Descartada por dos razones**: (1) agrega ~3KB gzipped de Zod al bundle del FE (PWA mobile-first — cada KB cuenta en 3G/4G boliviano); (2) acopla el FE al runtime de Zod, lo que dificulta migrar a Valibot o cualquier otra librería liviana en el futuro. La constitución § 2.2 no lista Zod en el FE — agregarlo requiere enmienda.

### Opción B — OpenAPI generado desde Zod del BE → `openapi-typescript` en FE (lo elegido para post-deploy)

El backend ya tiene Zod schemas en cada `validators.ts`. Con `zod-to-openapi` (~5h de trabajo) se genera `docs/api/openapi.yaml`. El FE consume ese YAML con `openapi-typescript` y obtiene tipos sincronizados automáticamente, sin Zod en bundle. La validación de formularios se hace con la librería que prefiera el FE (hand-rolled hoy, posiblemente Valibot o react-hook-form + Zod **opcional** mañana).

### Opción C — Migrar a tRPC

Eliminaría todo el problema: BE y FE comparten tipos vía RPC type-safe. **Descartada**: cambio arquitectónico mayor (REST → RPC), incompatible con la regla "REST con endpoints bien definidos cubre los casos" del Principio V. tRPC además acopla FE↔BE en el código, lo que dificulta exponer la API a clientes externos en el futuro (e.g. mobile nativo).

## Consecuencias

### Positivas

- Bundle del FE permanece liviano (sin Zod runtime)
- Contracts package compila instant (solo .d.ts), sin overhead de tree-shaking de schemas
- Sin acoplamiento del FE a Zod específicamente — libertad de elegir librería de validación FE
- OpenAPI cierra el gap de drift FE↔BE en post-deploy con costo controlado (~5h)

### Negativas / aceptadas

- **Hoy**: tipos sincronizados manualmente entre FE y BE. Si un campo cambia de `string` a `number` en BE, hay que recordar actualizar el tipo en `@surmoda/contracts`. El compilador de TS atrapa el resto de la cadena.
- **Hoy**: el FE no puede dar feedback granular de validación pre-submit (excepto reglas obvias como "required"). El usuario ve errores del backend
- **Hoy**: si el BE valida con regex o `.refine()` complejo, el FE no replica esa validación

### Acciones de seguimiento

- **Post-deploy (Quick Win #3)**: implementar `zod-to-openapi`, generar `docs/api/openapi.yaml`, configurar `openapi-typescript` en FE, deprecar tipos manualmente sincronizados en `@surmoda/contracts` (mantener solo constantes y enums)
- Hasta entonces: revisar cualquier cambio de DTO en code review como "¿actualizaste contracts?"
- Documentar en `docs/setup.md` el plan de OpenAPI para futuros mantenedores

## Evidencia Flipped Interaction (tesis)

**Pregunta de la IA**: "Detecté que `@surmoda/contracts` exporta solo tipos TS. El BE valida con Zod, el FE no comparte esa validación. ¿Querés que mueva Zod al package? Antes de decidir: ¿cuánto pesa el bundle FE actual y querés agregarle ~3KB?"

**Alternativas presentadas**: (A) Zod en contracts (FE empieza a depender), (B) OpenAPI generado desde Zod BE → `openapi-typescript` en FE, (C) tRPC.

**Elección humana**: Opción B, **pero diferida a post-deploy**. Razón: "antes del 8 de mayo no toco el contrato FE↔BE. Después de defensa, OpenAPI me sirve también para documentar la API. Con eso mato dos pájaros de un tiro."

**Cómo Flipped evitó error**: la IA podría haber agregado Zod a contracts "porque es lo correcto" y aumentado el bundle del PWA mobile-first sin advertirlo. La pregunta forzó al usuario a priorizar (defensa primero, drift después) y descubrió un Quick Win post-deploy de paso. La decisión queda registrada para que el equipo no la "redescubra" en 6 meses.
