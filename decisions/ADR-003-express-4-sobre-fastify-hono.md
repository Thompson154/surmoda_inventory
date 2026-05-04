# ADR-003 — Express 4 (modo mantenimiento) sobre Fastify/Hono

- **Estado**: Aceptado
- **Fecha**: 2026-05-01
- **Autores**: Adrian Thompson
- **Versión constitución**: v1.0.1

## Contexto

La constitución § 2.2 fija **Express 4+** como NON-NEGOTIABLE. La realidad del ecosistema en 2026-05-01:

- Express 4.21 entró en modo mantenimiento desde finales de 2024. Recibe security patches pero no nuevas features.
- Express 5.0 está en beta desde 2024 con cambios breaking en routing y error handling. No hay fecha estable confirmada.
- Fastify 4 es la alternativa madura más moderna: ~3x más rápido en benchmarks, schema-based validation built-in, plugin system maduro.
- Hono 4 es edge-native (Cloudflare Workers, Deno, Bun) — cambio de runtime, no solo de framework.

El audit del 2026-05-01 levantó la pregunta: ¿el equipo está cómodo con Express 4 hasta post-defensa, o conviene migrar antes? La respuesta requiere ADR explícito porque "la constitución dice Express 4" no es razonamiento — es una declaración cuyo motivo debe registrarse.

## Decisión

**Mantener Express 4.21** hasta después del deadline del proyecto de grado (2026-05-08). Post-defensa, evaluar migración a Express 5 cuando salga estable, o a Fastify 4 si aparecen requisitos de performance que lo justifiquen contra el Principio V.

## Alternativas consideradas

### Opción A — Express 5 beta

Misma API mental, soporte futuro asegurado. Riesgo de bugs en beta corriendo en producción durante una defensa de tesis. **Descartada**: no se introduce software en beta a 7 días del deadline. Re-evaluar Q3 2026 cuando 5.0 sea stable.

### Opción B — Fastify 4

Mejor performance (~80k req/s vs ~25k req/s de Express 4 en lab), schema validation con JSON Schema integrada (podría reemplazar parte de Zod), ecosystem maduro. **Descartada**: API distinto (hooks vs middleware, no mismo concepto de `req/res`), todos los integration tests con Supertest se reescribirían, todo el equipo (Adrian + futuros mantenedores) debe re-aprender. Costo migración ~40h. Sin caso de uso real que pida 80k req/s.

### Opción C — Hono

Edge-native, ~120k req/s, pero asume runtime tipo Cloudflare Workers/Bun/Deno. Cambia el modelo de deploy. **Descartada**: el deploy target es Render/Railway con Node.js 22 LTS. Hono en Node.js no aporta beneficio real y agrega abstracción innecesaria.

### Opción D — Express 4 (lo elegido)

Estable, ecosystem maduro (todo plugin que necesitemos existe), middleware mental conocido, todos los tests Supertest siguen vigentes. Performance "buena, no excelente": ~25k req/s en lab, suficiente para ~50 ventas/día reales (~0.0006 req/s en p95).

## Consecuencias

### Positivas

- Cero riesgo de regresión a 7 días del deadline
- Todo el código de middleware (`authGuard`, `errorHandler`, `auditLogger`, `rateLimiter`) ya está escrito y testeado
- Plugins maduros: `helmet`, `express-rate-limit`, `cookie-parser`, todos battle-tested
- Decisión defendible en tesis: "elegí Express 4 porque es la opción conservadora coherente con Principio V, no porque no conozca las alternativas"

### Negativas / aceptadas

- Performance "buena, no excelente". Para una boutique con ~50 ventas/día y picos en horario comercial, la diferencia con Fastify es académica
- Express 5 stable eventualmente requerirá migración (cambios breaking en routing async)
- No tenemos schema validation built-in en el framework — la suplimos con Zod en `validators.ts` (decisión coherente con § 2.2)

### Acciones de seguimiento

- Monitorear release notes de Express 5 — cuando salga `5.0.0` stable, abrir issue `chore: evaluar migración a Express 5` y revisar contra changelog
- Si JMeter post-deploy reporta p95 fuera de SLA en endpoints críticos por overhead del framework (improbable), reevaluar Fastify
- No introducir abstracciones que impidan migración futura: mantener controllers thin, services puros, sin acoplamiento al objeto `req` fuera de capa Routes/Middleware

## Evidencia Flipped Interaction (tesis)

**Pregunta de la IA**: "Express 4 está en modo mantenimiento. Express 5 sigue en beta. Fastify es ~3x más rápido. ¿Querés que evalúe migrar antes del 8 de mayo, o consolidamos Express 4 hasta defensa?"

**Alternativas presentadas**: (A) Express 5 beta, (B) Fastify 4, (C) Hono edge-native, (D) Express 4 actual.

**Elección humana**: Opción D. Razón textual: "estamos a 7 días, no toco el framework. Si necesito 80k req/s en una boutique de 1 sucursal, hay un problema mayor."

**Cómo Flipped evitó error**: la pregunta forzó a verbalizar el threat model real ("¿cuántas req/s reales vamos a tener?") antes de elegir framework por moda. Si la IA hubiera implementado en silencio, podría haber introducido Hono "porque es moderno" y dejado al humano con un stack que nadie del jurado conoce. Documentar la decisión convierte una elección defensiva en una elección defendible.
