# Contribuir a Sur Moda

Este documento es la regla del juego para cualquiera que pushee código a este repo —
incluido el equipo del proyecto y cualquier colaborador externo. Si algo de acá choca
con la `.specify/memory/constitution.md`, gana la constitución.

---

## 1. Stack y prerequisitos

- **Node** ≥ 22.x (declarado en `engines.node`)
- **npm** workspaces (no pnpm, no yarn — el monorepo está calzado para npm)
- **PostgreSQL** 15 (vía Docker — ver `docs/08-despliegue.md`)

---

## 2. Setup local

```bash
git clone git@github.com:Thompson154/surmoda_inventory.git
cd surmoda_inventory
npm ci

# .env del backend
cp apps/api/.env.example apps/api/.env
# editar apps/api/.env con tus credenciales locales

# DB local (asume contenedor `pg-degrado` corriendo)
npm run prisma:migrate -w @proyecto-degrado/api
npm run prisma:seed -w @proyecto-degrado/api

# arrancar
npm run dev:api    # API en :3000
npm run dev:web    # Vite dev server en :5173
```

Cualquier valor en `.env.example` que no esté en tu `.env` hace fallar el boot del
backend con un error de zod. Es a propósito.

---

## 3. Branches

```
main ← dev ← feat/<descripción> | fix/<descripción> | chore/<descripción>
```

- `main` está protegido — sólo se mergea desde `dev` cuando todo el pipe pasa.
- `dev` es el integration branch. Toda feature/fix nace desde `dev`.
- Una feature, una branch. `feat/014-stock-transfers` no `feat/multiple-things`.

**Nunca** pushees directo a `main` o `dev`. Hacé PR.

---

## 4. Conventional Commits (obligatorio)

`commitlint` rechaza cualquier mensaje que no siga el formato:

```
<type>(<scope>): <subject>

<body opcional>
```

Tipos válidos: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `style`, `perf`, `build`, `ci`, `revert`.

Ejemplos buenos:

```
feat(015): audit log viewer for admin and encargada
fix(deliveries): partial reception leak when receivedQuantity = 0
chore(security): tighten Helmet CSP
```

Ejemplos rechazados:

```
WIP                                      # type vacío
feat: add UPPERCASE thing                # subject upper-case
Updated stuff                            # sin type
```

El subject va en lowercase y debajo de 100 chars.

---

## 5. Pre-commit hooks (automáticos via husky)

Cuando hacés `git commit` corre:

1. **lint-staged** sobre archivos modificados:
   - `*.{ts,tsx,js}` → `eslint --fix && prettier --write`
   - `*.{json,md,yml}` → `prettier --write`
2. **commitlint** valida el mensaje.

Si alguno falla, el commit no se crea. **No bypassees con `--no-verify`** salvo que
estés haciendo un revert de emergencia.

---

## 6. Tests

```bash
# todo el monorepo
npm test

# por workspace
npm test -w @proyecto-degrado/api
npm test -w @proyecto-degrado/web

# subsetting
npm run test:unit -w @proyecto-degrado/api
npm run test:integration -w @proyecto-degrado/api -- --testPathPattern=deliveries
```

**Antes de abrir un PR**:

- ✅ `npm test` verde
- ✅ `npm run type` verde en los 3 workspaces
- ✅ `npm run lint` con 0 errors (los warnings están aceptados como backlog)

CI corre todo lo anterior + build + migration dry-run en GitHub Actions.

---

## 7. Cobertura de tests

| Capa                      | Mínimo esperado                                               |
| ------------------------- | ------------------------------------------------------------- |
| BE services               | tests unitarios + caso de éxito + caso de error + RBAC denial |
| BE routes                 | tests integration con login real y RBAC matrix                |
| FE componentes con lógica | vitest + Testing Library con MSW                              |
| FE flujos críticos        | Playwright E2E (mobile-first)                                 |

Una feature no se mergea si no tiene tests. **No es negociable.**

---

## 8. PRs

- Título: usar el mismo formato que un commit (`feat(NNN): …`).
- Cuerpo: qué cambia + por qué + cómo se probó. No es una novela; 5-10 líneas alcanzan.
- Auto-asignate como reviewer si trabajás solo. Si hay otro dev, pediselo a él.
- **Siempre** con un E2E manual mínimo en mobile (Chrome DevTools device toolbar)
  antes de pedir review.
- Squash al mergear para mantener `dev` legible. Los commits intermedios viven en
  el historial del PR si alguien quiere bisectar.

---

## 9. Hot zones — cuidado al editar

Estas piezas son frágiles o tienen invariantes que un dev nuevo no ve a primera vista:

- **`apps/api/src/shared/auth/storeScope.ts`** — RBAC. Si tocás esto, agregá tests
  de matrix (admin / encargada-global / vendedora / vendedora-otra-store).
- **`apps/api/src/modules/deliveries/service.ts`** — state machine + stock atómico.
  Cualquier cambio debe pasar por una `Prisma.$transaction` con `Serializable`.
- **`apps/api/src/middleware/auditLogger.ts`** — fire-and-forget; nunca debe lanzar.
- **`apps/api/prisma/schema.prisma`** — cualquier cambio requiere migración generada
  con `prisma migrate dev --create-only` y review explícito del SQL.

---

## 10. Consultas

- Documentación arquitectónica: `docs/01-09`.
- Constitución (regla suprema): `.specify/memory/constitution.md`.
- Memoria de decisiones: el repo usa engram (consultar al equipo).
