# Surmoda Inventory — Sistema multi-tienda de inventario y ventas

Sistema web / PWA para la gestión de inventario, entregas entre sedes y registro de ventas de **Surmoda**, una cadena de ropa con tiendas en La Paz, Bolivia. El proyecto reemplaza el manejo manual con planillas Excel por un flujo digital con trazabilidad completa: stock por sede, escaneo de barcode, cierre de caja automatizado y control de acceso basado en roles.

Este repositorio es la base del Proyecto de Grado del autor. La **Feature 001 (Auth + RBAC)** está completa y en producción en la rama `main`; las features 002-009 (tiendas, inventario, entregas, ventas, reportes) están planificadas para la defensa.

---

## Stack tecnológico

### Backend (`apps/api`)

| Tecnología | Versión | Rol |
|---|---|---|
| Node.js | 22 LTS | Runtime |
| TypeScript | 5.6 | Lenguaje |
| Express | 4.21 | HTTP framework |
| Prisma | 5.22 | ORM / migraciones |
| PostgreSQL | 16+ | Base de datos |
| Zod | 3.24 | Validación de esquemas |
| jsonwebtoken | 9.0 | JWT (access tokens) |
| bcrypt | 5.1 | Hash de contraseñas |
| Pino | 9.5 | Logger estructurado |
| Helmet / CORS | 8.0 / 2.8 | Seguridad HTTP |
| Jest + Supertest | 29.7 / 7.0 | Pruebas unitarias e integración |

### Frontend (`apps/web`)

| Tecnología | Versión | Rol |
|---|---|---|
| React | 18.3 | UI |
| TypeScript | 5.6 | Lenguaje |
| Vite | 5.4 | Bundler |
| TanStack Query | 5.62 | Server state / caché |
| Zustand | 5.0 | Client state (auth) |
| React Router | 6.28 | Enrutamiento |
| Tailwind CSS | 4.0 | Estilos |
| Vitest + Testing Library + MSW | 2.1 / 16.1 / 2.7 | Pruebas de componentes |

### Compartido (`packages/contracts`)

- `@surmoda/contracts` — tipos TypeScript y constantes de error compartidos entre BE y FE.

---

## Estructura del proyecto

```
surmoda-inventory/
├── apps/
│   ├── api/                     # Backend REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Modelos y migraciones
│   │   │   └── seed.ts          # Datos iniciales
│   │   └── src/
│   │       ├── index.ts         # Punto de entrada + cron
│   │       ├── server.ts        # Express + middlewares
│   │       ├── composition.ts   # Raíz de composición (DI)
│   │       ├── infrastructure/  # config, database, jwt, logger
│   │       ├── middleware/      # authGuard, roleGuard, errorHandler, etc.
│   │       ├── modules/
│   │       │   ├── auth/        # Login, refresh, logout, me
│   │       │   ├── users/       # CRUD usuarios + password-reset
│   │       │   ├── assignments/ # Asignaciones usuario-tienda
│   │       │   └── auditing/    # AuditService (fire-and-forget)
│   │       └── shared/          # AppError, errorCodes, constantes
│   └── web/                     # Frontend SPA / PWA
│       └── src/
│           ├── app/             # App.tsx, Providers.tsx
│           ├── features/
│           │   ├── auth/        # Login, logout, stores, hooks
│           │   └── users/       # Listado, creación, detalle, assignments
│           └── shared/
│               ├── services/    # httpClient (interceptor 401/refresh)
│               └── ui/          # Primitivos: Button, Input, Field, Modal…
├── packages/
│   └── contracts/               # @surmoda/contracts — tipos y errorCodes
├── docs/                        # Documentación técnica de tesis
├── .github/workflows/ci.yml     # Pipeline CI (lint → type → test → build)
├── package.json                 # npm workspaces raíz
└── tsconfig.base.json           # Opciones TypeScript compartidas (strict)
```

---

## Quickstart

### Prerrequisitos

- **Node.js** 22 LTS o superior
- **npm** 10 o superior
- **PostgreSQL** 16 o superior (local o Docker)

### 1. Clonar e instalar

```bash
git clone <url-del-repositorio>
cd surmoda-inventory
npm install
```

### 2. Variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
```

Editar `apps/api/.env` con los valores correspondientes. Los campos obligatorios son `DATABASE_URL` y `JWT_SECRET`. Ver [docs/08-despliegue.md](./docs/08-despliegue.md) para descripción completa de cada variable.

### 3. Base de datos

```bash
# Aplicar migraciones y generar el cliente Prisma
npm run prisma:migrate

# Insertar datos semilla (admin por defecto)
npm run prisma:seed
```

### 4. Ejecutar en desarrollo

```bash
# Backend (puerto 3000 por defecto)
npm run dev:api

# Frontend (puerto 5173 por defecto)
npm run dev:web
```

---

## Pruebas

```bash
# Todas las suites (BE unit + integración + FE componentes)
npm test

# Solo backend — unit
npm run test:unit -w @proyecto-degrado/api

# Solo backend — integración (requiere DATABASE_URL_TEST activa)
npm run test:integration -w @proyecto-degrado/api

# Solo frontend
npm test -w @proyecto-degrado/web

# Con cobertura
npm run test:coverage
```

---

## Arquitectura

El sistema sigue una **arquitectura por capas** en el backend (HTTP → Controllers → Services → Repositories → Prisma → PostgreSQL) con una **raíz de composición** explícita (`composition.ts`) como único punto de inyección de dependencias. No se utiliza un contenedor IoC externo; las dependencias se pasan como objetos literales tipados en TypeScript. El frontend aplica **Atomic Design** para la organización de componentes y separa el estado del servidor (TanStack Query) del estado de cliente (Zustand). Los tipos compartidos viven en el paquete `@surmoda/contracts` para garantizar una única fuente de verdad entre ambas capas.

Ver [docs/04-arquitectura.md](./docs/04-arquitectura.md) para el documento completo.

---

## Documentación

La documentación técnica de tesis está en [`docs/`](./docs/). Comenzar por [`docs/README.md`](./docs/README.md).

---

## Licencia

MIT

## Autor

Adrián Thompson
