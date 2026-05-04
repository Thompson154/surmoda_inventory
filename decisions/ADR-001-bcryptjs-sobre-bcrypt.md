# ADR-001 — bcryptjs en lugar de bcrypt

- **Estado**: Aceptado
- **Fecha**: 2026-05-01
- **Autores**: Adrian Thompson
- **Versión constitución**: v1.0.1

## Contexto

La constitución v1.0.0, Principio II § 2.2, fija `bcrypt` (binding nativo a OpenSSL/libcrypt) como librería oficial para hashing de passwords. Durante el Tier 2 swap (commit `8ab24b8`) se cambió a `bcryptjs` sin ADR formal. El audit del 2026-05-01 (Wave 4) detectó este drift como riesgo de auditoría: el revisor de tesis puede preguntar "¿por qué la constitución dice una cosa y el código hace otra?" y no había respuesta documentada.

Adicionalmente, `bcrypt` requiere binding nativo (`node-gyp` + toolchain de C++) que complica builds en plataformas serverless / contenedores Alpine, y bloquea Render/Railway free-tier en dynos sin dev-tools.

## Decisión

Mantener `bcryptjs@3.x` (pure JavaScript, sin native bindings) con OWASP-floor de salt rounds **≥12 en producción** (validado vía Zod schema en `apps/api/src/infrastructure/config.ts`).

## Alternativas consideradas

### Opción A — Volver a `bcrypt` nativo

Performance ~2-3x mejor (~10ms hash vs ~25ms en M1). Standard de facto en Node.js. Requiere toolchain de build en cada plataforma destino. Históricamente sufre breaking changes en upgrades de Node. **Descartada**: el costo operativo (build pipelines más frágiles, debugging de native bindings en producción) supera el beneficio de performance para una boutique con ~20 logins/día.

### Opción B — Migrar a `argon2`

OWASP recomienda Argon2id para nuevos proyectos desde 2023 (mejor resistencia a GPU/ASIC attacks). Más moderno, también requiere native bindings. **Descartada**: cambia el stack documentado en la constitución, requiere migración de hashes existentes (re-hash on next login pattern), y para una boutique pequeña el threat model no justifica el cambio.

### Opción C — Mantener `bcryptjs` (lo elegido)

Pure JS, sin native deps, builds simples en cualquier plataforma. Performance ~25ms por hash en M1 (irrelevante para 20 logins/día). API 100% compatible con `bcrypt` — el código que llama no cambia.

## Consecuencias

### Positivas

- Builds reproducibles en cualquier plataforma (Render, Railway, Vercel, locales) sin toolchain de C++
- Sin sorpresas en upgrades de Node 22 → 24 (no recompilación nativa)
- Mismo API que `bcrypt` — el switch es transparente para Services y middleware
- `@types/bcryptjs@2.4` ya estaba listo para TypeScript

### Negativas / aceptadas

- Hash ~2-3x más lento que `bcrypt` nativo. Para nuestro volumen (~20 logins/día, 0 hash en hot path de ventas), totalmente irrelevante
- Drift explícito vs constitución v1.0.0 — resuelto en v1.0.1 actualizando § 2.2 para listar `bcryptjs` como variante aceptada y referenciando este ADR
- La comunidad asume `bcrypt` por default — onboarding requiere mencionar el cambio

### Acciones de seguimiento

- Validar que el test que asegura `BCRYPT_SALT_ROUNDS ≥ 12` en producción siga vivo en `apps/api/src/infrastructure/config.ts` (Zod refinement)
- Incluir nota en `docs/setup.md` explicando el porqué del cambio para futuros mantenedores
- Si se llega a >100 logins/día concurrentes, reevaluar contra `argon2` post-deploy

## Evidencia Flipped Interaction (tesis)

**Pregunta de la IA durante Tier 2 swap**: "El stack listado dice `bcrypt`. Estoy detectando que en `apps/api/package.json` se instaló `bcryptjs`. ¿Es intencional? Si lo es, necesito un ADR — la constitución § 2.2 lista `bcrypt`, no `bcryptjs`. Si NO es intencional, hay que volver atrás antes de que se solidifique."

**Alternativas que la IA presentó**: (A) volver a `bcrypt` nativo, (B) migrar a `argon2`, (C) formalizar `bcryptjs` con ADR + bump de constitución.

**Elección humana**: Opción C. Razón explícita del usuario: "no quiero pelear con node-gyp en cada deploy y para 20 logins por día no me importa la diferencia de 15ms". Decisión documentada antes de continuar implementando features que dependieran del módulo de auth.

**Cómo Flipped evitó error**: sin la pregunta proactiva de la IA, el drift hubiera quedado silencioso y aparecido en code review post-deploy o, peor, en defensa de tesis. Documentar al momento del swap convierte una "deuda invisible" en una "decisión defendible".
