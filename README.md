# Surmoda Inventory — Sistema multi-tienda de inventario y ventas

Sistema web / PWA para la gestión de inventario, entregas inter-sucursal, registro de ventas, cierre diario y reportes de **Surmoda**, una cadena boliviana de ropa femenina con almacén central y tres sucursales en La Paz. Reemplaza el manejo manual con planillas Excel por un flujo digital con trazabilidad completa: stock por sucursal, escaneo de barcode con la cámara, control de acceso basado en roles, auditoría inmutable y solicitudes de cambio aprobadas por administrador.

> **Estado actual:** los 14 módulos del alcance original + el workflow nuevo de solicitudes de cambio (Wave 5/6) están implementados. **567 tests verdes** (337 unit + 230 integration BE, 372 FE). Listo para defensa de proyecto de grado.

---

## Stack tecnológico

### Backend (`apps/api`)

| Tecnología                          | Versión | Rol                                                                                       |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| Node.js                             | 22 LTS  | Runtime                                                                                   |
| TypeScript                          | 5.6     | Lenguaje (strict)                                                                         |
| Express                             | 4.21    | HTTP framework                                                                            |
| Prisma                              | 5.22    | ORM + migraciones                                                                         |
| PostgreSQL                          | 15+     | Base de datos relacional                                                                  |
| Zod                                 | 3.24    | Validación de esquemas                                                                    |
| jsonwebtoken                        | 9.0     | JWT (access tokens)                                                                       |
| bcryptjs                            | 3+      | Hash de contraseñas — ver [ADR-001](./decisions/ADR-001-bcryptjs-sobre-bcrypt.md)         |
| Pino                                | 9.5     | Logger estructurado                                                                       |
| Helmet / CORS                       | 8 / 2.8 | Headers de seguridad + CORS                                                               |
| express-rate-limit                  | 7+      | Rate limiting                                                                             |
| node-cron                           | 4+      | Jobs periódicos in-process — ver [ADR-002](./decisions/ADR-002-node-cron-sobre-bullmq.md) |
| ExcelJS                             | 4+      | Generación streaming de reportes Excel                                                    |
| zod-to-openapi + swagger-ui-express | 7 / 5   | OpenAPI generado + Swagger UI (`/docs` en dev)                                            |
| Jest + Supertest                    | 29 / 7  | Pruebas unitarias e integración                                                           |

### Frontend (`apps/web`)

| Tecnología                     | Versión    | Rol                                                 |
| ------------------------------ | ---------- | --------------------------------------------------- |
| React                          | 18.3       | UI                                                  |
| TypeScript                     | 5.6        | Lenguaje (strict)                                   |
| Vite                           | 5.4        | Bundler + dev server                                |
| Tailwind CSS                   | 4.0        | Estilos (con `@theme {}`, sin `tailwind.config.js`) |
| Zustand                        | 5.0        | Client state (auth + theme)                         |
| TanStack Query                 | 5          | Server state, cache, revalidación                   |
| React Router                   | 6          | Routing SPA                                         |
| `@sec-ant/barcode-detector`    | latest     | Escaneo de barcode con cámara                       |
| jsbarcode                      | 3+         | Generación de etiquetas de barcode                  |
| vite-plugin-pwa                | 0.20+      | PWA (manifest + Service Worker)                     |
| Vitest + Testing Library + MSW | 2 / 16 / 2 | Pruebas de componentes + API mock                   |

### Compartido (`packages/contracts`)

`@surmoda/contracts` — tipos TypeScript, enums (`Role`, `PaymentMethod`, `StockMovementType`) y constantes de error (`ERROR_CODES`) sincronizadas entre backend y frontend.

---

## Estructura del proyecto

```
surmoda-inventory/
├── apps/
│   ├── api/                              # Backend REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # 19 entidades + enums
│   │   │   ├── migrations/               # 20 migraciones secuenciales
│   │   │   └── seed.ts                   # Datos demo idempotentes
│   │   └── src/
│   │       ├── index.ts                  # Bootstrap + cron jobs
│   │       ├── server.ts                 # Express + middleware + /health + /docs
│   │       ├── composition.ts            # Raíz de composición (DI explícita)
│   │       ├── infrastructure/           # config (Zod), database (Prisma), logger (Pino)
│   │       ├── middleware/               # authGuard, roleGuard, errorHandler, rateLimiter
│   │       ├── jobs/                     # dailyLock, inventorySnapshot (node-cron)
│   │       ├── openapi/                  # Builder + generator (zod-to-openapi)
│   │       ├── modules/
│   │       │   ├── auth/                 # Login, refresh, logout, /me
│   │       │   ├── users/                # CRUD usuarios + password-reset
│   │       │   ├── assignments/          # Asignaciones usuario-sucursal-rol
│   │       │   ├── stores/               # Sucursales y almacén
│   │       │   ├── products/             # Catálogo + variantes + barcode + Cloudinary
│   │       │   ├── inventory/            # Stock perpetuo + movements
│   │       │   ├── inventory-snapshots/  # Capturas semanales inmutables
│   │       │   ├── deliveries/           # Entregas + edit-requests workflow
│   │       │   ├── sales/                # Ventas + idempotencia + 30% discount cap
│   │       │   ├── return-requests/      # Solicitudes de cambio con aprobación admin
│   │       │   ├── dailyReports/         # Cierre diario + lock 22:00
│   │       │   ├── reports/              # Reportes Excel streaming
│   │       │   ├── alerts/               # Alertas de stock bajo
│   │       │   └── auditing/             # AuditLog fire-and-forget
│   │       └── shared/
│   │           ├── auth/                 # storeScope, permissions matrix, can()
│   │           └── constants/            # errorCodes, roles, tokenConfig
│   └── web/                              # Frontend SPA / PWA
│       └── src/
│           ├── app/                      # App.tsx, ProtectedRoute, Providers
│           ├── features/                 # auth, users, stores, products, inventory,
│           │                             # deliveries, sales, return-requests, reports,
│           │                             # alerts, audit, admin
│           └── shared/
│               ├── auth/                 # usePermissions hook, permissions matrix (mirror BE)
│               ├── ui/                   # Button, Modal, ConfirmDialog, Toast, etc.
│               ├── services/             # httpClient (interceptor 401/refresh)
│               └── format/, layout/, theme/, hooks/
├── packages/
│   └── contracts/                        # @surmoda/contracts
├── decisions/                            # ADRs (evidencia de tesis)
│   ├── ADR-001-bcryptjs-sobre-bcrypt.md
│   ├── ADR-002-node-cron-sobre-bullmq.md
│   ├── ADR-003-express-4-sobre-fastify-hono.md
│   ├── ADR-004-contracts-types-only.md
│   └── ADR-005-cloudinary-vendor-lock-in.md
├── docs/
│   └── api/openapi.yaml                  # OpenAPI generado desde schemas Zod
├── .specify/memory/constitution.md       # Constitución v1.1.0 (principios + governance)
├── .github/workflows/ci.yml              # CI: lint, type, test, coverage advisory, build, migrate
├── package.json                          # npm workspaces raíz
└── tsconfig.base.json                    # TS strict + noUncheckedIndexedAccess
```

---

## Quickstart

### Prerrequisitos

- **Node.js** 22 LTS o superior
- **npm** 10 o superior
- **PostgreSQL** 15 o superior (local o Docker)

### 1. Clonar e instalar

```bash
git clone https://github.com/Thompson154/surmoda_inventory.git
cd surmoda_inventory
npm install
```

### 2. Variables de entorno

Crear `apps/api/.env` con las siguientes variables (todas validadas por Zod en `apps/api/src/infrastructure/config.ts`):

```bash
# Obligatorias
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/proyectodegrado
JWT_SECRET=cambiame-por-un-secreto-de-al-menos-32-caracteres-en-prod

# Opcionales (con defaults)
NODE_ENV=development                    # development | test | production
PORT=3000
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/proyectodegrado_test
COOKIE_DOMAIN=localhost
FE_ORIGIN=http://localhost:5173
ACCESS_TOKEN_TTL_MIN=15
REFRESH_TOKEN_TTL_DAYS=7
BCRYPT_SALT_ROUNDS=12                   # mínimo 4 (test), recomendado 12 (prod)
RATE_LIMIT_LOGIN_PER_MIN=10
RATE_LIMIT_REFRESH_PER_MIN=30
LOG_LEVEL=info                          # fatal | error | warn | info | debug | trace | silent
ENABLE_DAILY_SALES_LOCK=false           # cron 22:00 La_Paz (opt-in)
ENABLE_SNAPSHOT_CRON=false              # cron domingos 03:00 (opt-in en dev)
```

Para el frontend, `apps/web/.env` (opcional — usa defaults razonables si está vacío):

```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 3. Base de datos

```bash
# Crear la BD si no existe
createdb proyectodegrado
createdb proyectodegrado_test   # opcional, para tests de integración

# Aplicar las 20 migraciones y generar el cliente Prisma
npm run prisma:migrate

# Seed idempotente con datos de demo
npm run prisma:seed
```

#### Credenciales seed

| Rol              | Email                        | Password    |
| ---------------- | ---------------------------- | ----------- |
| Admin            | `admin@demo.local`           | `Admin1234` |
| Encargada Prado  | `encargada.prado@demo.local` | `Pass1234`  |
| Vendedora Prado  | `vendedora.prado@demo.local` | `Pass1234`  |
| Vendedora Z. Sur | `vendedora.zsur@demo.local`  | `Pass1234`  |
| Multi-rol (test) | `multi@demo.local`           | `Pass1234`  |

### 4. Ejecutar en desarrollo

```bash
# Backend (puerto 3000)
npm run dev:api

# Frontend (puerto 5173) — en otra terminal
npm run dev:web
```

Abrí [http://localhost:5173](http://localhost:5173) y logueate con cualquiera de las credenciales del seed.

### 5. Endpoints útiles en dev

- `GET /health/live` — keep-alive (sin DB check)
- `GET /health/ready` — verifica que la BD responda (`SELECT 1`)
- `GET /docs` — Swagger UI (solo en dev, sirve `docs/api/openapi.yaml`)

---

## Pruebas

```bash
# Backend completo (unit + integration)
npm test -w @proyecto-degrado/api

# Solo unit
npm run test:unit -w @proyecto-degrado/api

# Solo integration (requiere DATABASE_URL_TEST con migraciones aplicadas)
npm run test:integration -w @proyecto-degrado/api

# Frontend completo
npm test -- --run -w @proyecto-degrado/web

# Cobertura (advisory en CI)
npm run test:coverage -w @proyecto-degrado/api
npm run test:coverage -w @proyecto-degrado/web

# E2E (Playwright — opcional)
npm run test:e2e
```

### Generar el OpenAPI desde los schemas Zod

```bash
npm run openapi -w @proyecto-degrado/api
# → escribe docs/api/openapi.yaml
```

---

## Arquitectura

El sistema sigue una **arquitectura de 6 capas** con dependencia estricta hacia abajo:

- **Backend:** `Routes → Middleware → Controllers → Services → Repositories → Infrastructure`
- **Frontend:** `Pages → Components → Hooks → Stores → Services → Types`

Pilares fundamentales (constitución v1.1.0):

- **Inventario perpetuo:** todo cambio de stock vive dentro de `Prisma.$transaction()` y genera un `StockMovement` inmutable
- **Composición explícita:** la raíz de DI vive en `composition.ts`; sin contenedores IoC externos
- **3 roles:** `admin` (control total) · `encargada` (recibe entregas, lee inventario) · `vendedora` (registra ventas + cierra día)
- **JWT dual:** access token en memoria (Zustand), refresh token en `httpOnly cookie` con rotación
- **Auditoría:** AuditLog fire-and-forget con `setImmediate` (overhead < 50 ms)
- **Strict TDD:** los tests se escriben antes que la implementación; cobertura objetivo ≥80% en `services` y `repositories` (gateada como advisory en CI)

Ver [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) para el documento rector completo y [`decisions/`](./decisions/) para los ADRs.

---

## Workflow de desarrollo

```
main                              ← producción, siempre estable
  └── dev                         ← integración
        └── feat/<módulo>-<desc>  ← una branch por feature (FE + BE juntos)
        └── fix/<módulo>-<desc>
```

- **Conventional Commits en inglés** obligatorio (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `perf:`)
- Pre-commit hook (`husky`) corre lint + type check
- CI bloquea merge si: lint falla, type check falla, tests rojos, build falla, migrate falla
- Coverage en jobs `coverage-fe` / `coverage-be` corre con `continue-on-error: true` (advisory hasta cerrar el catch-up de tests)

---

## Documentación

- [Constitución del proyecto](./.specify/memory/constitution.md) — v1.1.0, source of truth
- [ADRs](./decisions/) — Architecture Decision Records (evidencia de tesis Flipped Interaction)
- [OpenAPI](./docs/api/openapi.yaml) — contrato de la API generado desde Zod
- [Documento de tesis](./docs/) (donde aplique)

---

## Licencia

MIT

## Autor

Adrián Thompson Machaca — Proyecto de Grado, Universidad Privada Boliviana, 2026
