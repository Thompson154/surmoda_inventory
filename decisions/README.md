# Architecture Decision Records (ADRs)

Esta carpeta contiene las decisiones arquitectónicas significativas del proyecto Sur Moda.

## Por qué existen

La constitución (Principio VI — Flipped Interaction Pattern, § 6.3) exige que toda decisión arquitectónica con la IA quede documentada como ADR aquí. Los timestamps de los commits prueban que las decisiones son anteriores a la implementación, no post-racionalización. **Estos ADRs son el dataset de la tesis.**

## Formato

MADR (Markdown ADR) — un archivo por decisión, numeración correlativa, immutable post-aceptación. Si una decisión cambia, se crea un nuevo ADR que supersede al anterior, no se edita el viejo.

## Índice

| #   | Título                                                       | Estado   | Fecha      |
| --- | ------------------------------------------------------------ | -------- | ---------- |
| 001 | bcryptjs en lugar de bcrypt                                  | Aceptado | 2026-05-01 |
| 002 | node-cron sobre BullMQ/Redis para jobs periódicos            | Aceptado | 2026-05-01 |
| 003 | Express 4 (modo mantenimiento) sobre Fastify/Hono            | Aceptado | 2026-05-01 |
| 004 | `@surmoda/contracts` como TS types-only (sin Zod compartido) | Aceptado | 2026-05-01 |
| 005 | Cloudinary como image storage (vendor lock-in aceptado)      | Aceptado | 2026-05-01 |
