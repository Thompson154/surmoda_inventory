# ADR-002 — node-cron sobre BullMQ/Redis para jobs periódicos

- **Estado**: Aceptado
- **Fecha**: 2026-05-01
- **Autores**: Adrian Thompson
- **Versión constitución**: v1.0.1

## Contexto

El sistema requiere dos jobs periódicos confirmados:

1. **Cierre de día automático** — diario a las 23:59 America/La_Paz, marca el día como cerrado en sucursales que no hicieron close manual
2. **Snapshot semanal de inventario** — domingos a las 03:00, captura estado del stock por tienda para reportes históricos

El Principio V (YAGNI) prohíbe explícitamente Redis, BullMQ y colas para casos fire-and-forget. Sin embargo, un sistema de jobs periódicos no es lo mismo que un sistema de mensajería async — ambos son legítimamente distintos. Hace falta una decisión documentada sobre qué herramienta usar dentro del marco del Principio V.

## Decisión

Usar `node-cron@3.x` **in-process** (mismo runtime que el API Express), con flag de entorno `ENABLE_SNAPSHOT_CRON` para opt-in en `development` (default `false`) y opt-out en `production` (default `true`). Los jobs se ejecutan dentro de `setImmediate` para no bloquear el event loop si sobrelapan con tráfico HTTP.

## Alternativas consideradas

### Opción A — BullMQ + Redis

Solución industrial estándar: producer/consumer, retry policies, dashboard, scheduling robusto. **Descartada**: requiere Redis (servicio externo + costo + monitoring), agrega 2 dependencias (`bullmq`, `ioredis`), y para 2 jobs/semana es overkill arquitectónico explícito por el Principio V. Aporta complejidad sin justificar 3 casos de uso reales.

### Opción B — Render Cron Jobs externos

Render ofrece cron jobs como servicio separado del web service, lo que evita que dynos dormidos pierdan ticks. **Mejor opción a largo plazo** pero requiere que el código de cierre de día esté expuesto vía HTTP endpoint protegido (auth interno o token), no solo callable in-process. **Descartada para v1**: agrega trabajo de hardening de un endpoint interno antes del deadline de tesis. Reservada como acción de seguimiento post-deploy.

### Opción C — `node-cron` in-process (lo elegido)

Un solo proceso, una sola dependencia ya instalada. Lock simple por flag para dev. Sin servicios externos. Debugging trivial: si el job falla, el log aparece en la misma consola que el API.

## Consecuencias

### Positivas

- 0 dependencias de infraestructura adicional (sin Redis, sin servicio cron separado)
- Debugging local: levantar `npm run dev` ya tiene el cron activo
- Coste 0 en free-tier de Render/Railway (no hay servicio aparte que pagar)
- `setImmediate` evita bloquear el event loop si el job coincide con tráfico

### Negativas / aceptadas

- **Cold start de free tier**: en Render/Railway free, los dynos duermen tras 15min de inactividad. Si nadie pega al API entre 22:00 y 23:59, el dyno está dormido y el cron de cierre de día NO se ejecuta. Mitigación documentada en acciones de seguimiento.
- Sin retry automático: si el job throwea, no se reintenta solo. Se loggea con `pino` y se confía en idempotencia (cierre de día es idempotente by design).
- No hay dashboard de "última ejecución" — se infiere del audit log y de los registros en DB.

### Acciones de seguimiento

- **Post-deploy obligatorio**: configurar Render Cron Job externo (servicio dedicado en Render, cuesta ~7USD/mes en hobby tier) que pegue a `/health/ready` cada 10 minutos en horario 22:00–00:30 America/La_Paz, garantizando que el dyno esté despierto cuando dispara el cron interno
- **Alternativa free**: migrar el cierre de día a un script CLI invocado por GitHub Actions schedule cron (workaround más frágil pero gratis)
- Documentar en `docs/setup.md` el comportamiento esperado en cada plataforma de deploy

## Evidencia Flipped Interaction (tesis)

**Pregunta de la IA**: "Tenés 2 jobs periódicos. ¿Querés que los corra el mismo proceso del API o querés un servicio dedicado? Antes de decidir, contame: ¿el deploy va a ser free-tier de Render/Railway, o pagado? Esto cambia la decisión."

**Alternativas presentadas**: (A) BullMQ + Redis, (B) Render Cron Jobs externos, (C) node-cron in-process.

**Elección humana**: Opción C **con caveat documentado**: "Sé que en free-tier vamos a perder ticks. Está bien para defensa de tesis (hago el cierre de día manual el día de la demo). Para producción real, pongo el cron de keep-alive después del 8 de mayo."

**Cómo Flipped evitó error**: la IA forzó al usuario a verbalizar el constraint de free-tier ANTES de elegir la herramienta. Sin esa pregunta, podría haber elegido BullMQ "porque es lo profesional" y agregado Redis sin justificación contra el Principio V, o elegido node-cron sin saber del cold-start gotcha. La pregunta convirtió una decisión técnica en una decisión informada de trade-offs.
