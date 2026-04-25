# 04 — Arquitectura del Sistema

---

## 1. Vista general

Surmoda Inventory es una aplicación cliente-servidor compuesta por dos aplicaciones independientes en un monorepo npm workspaces:

- **Backend** (`apps/api`): API REST construida con Express 4 sobre Node.js 22. Expone recursos JSON bajo el prefijo `/api/v1`.
- **Frontend** (`apps/web`): SPA (Single Page Application) con React 18, Vite 5 y TanStack Query 5. Se sirve como archivos estáticos; no hay SSR.

La comunicación entre ambas capas es exclusivamente HTTP/JSON. No existe WebSocket ni ningún canal en tiempo real en esta iteración.

---

## 2. Vista de capas — Backend

```
┌─────────────────────────────── HTTP layer (index.ts / server.ts) ───────────────────────────────┐
│                                                                                                   │
│   dotenv/config → loadConfig() → buildServer()                                                   │
│                                                                                                   │
│   Middlewares globales:                                                                           │
│     helmet()  cors()  cookieParser()  express.json()  attachAuditEmitter()                       │
│                                                                                                   │
│   ┌──────────────────── Composition Root (composition.ts) ────────────────────┐                  │
│   │  buildComposition()                                                        │                  │
│   │    getPrisma()           → db: Database                                   │                  │
│   │    buildAuditService(db) → auditService                                   │                  │
│   │                                                                            │                  │
│   │    buildRefreshTokenRepository(db)    ─┐                                  │                  │
│   │    buildAuthService({ db, refreshTokens })                                 │                  │
│   │    buildAuthController(authService)    │                                   │                  │
│   │    buildAuthRouter(authController)  ───┘ → authRouter                     │                  │
│   │                                                                            │                  │
│   │    buildUserRepository(db)                ─┐                              │                  │
│   │    buildUserService({ users, refreshTokens })                              │                  │
│   │    buildUserController(userService)         │                              │                  │
│   │    buildUsersRouter(userController)  ───────┘ → usersRouter               │                  │
│   │                                                                            │                  │
│   │    buildUserStoreRepository(db)             ─┐                            │                  │
│   │    buildAssignmentService({ assignments, users })                          │                  │
│   │    buildAssignmentController(assignmentService) │                          │                  │
│   │    buildAssignmentsRouter(assignmentController) ┘ → assignmentsRouter     │                  │
│   └───────────────────────────────��───────────────────────────────���────────────┘                  │
│                                                                                                   │
│   app.use('/api/v1/auth',              authRouter)                                                │
│   app.use('/api/v1/users',             usersRouter)                                               │
│   app.use('/api/v1/users/:userId/assignments', assignmentsRouter)                                 │
│                                                                                                   │
│   app.use(errorHandler)                                                                           │
│                                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
   Routes → Controllers → Services → Repositories → Prisma Client → PostgreSQL
```

### Descripción de capas

| Capa | Responsabilidad |
|------|----------------|
| **HTTP / server.ts** | Configura Express, aplica middlewares de seguridad, monta routers |
| **Composition root** | Único punto de inyección de dependencias; no hay contenedor IoC externo |
| **Routes** | Declaran paths HTTP, aplican middlewares de validación y autenticación, delegan al controlador |
| **Controllers** | Deserializan el request, invocan el servicio, serializan la respuesta, emiten auditoría |
| **Services** | Lógica de negocio pura; no conocen Express ni Prisma directamente |
| **Repositories** | Abstraen el acceso a datos; devuelven DTOs, no entidades Prisma crudas |
| **Infrastructure** | `config.ts` (Zod), `database.ts` (Prisma + soft-delete extension), `jwt.ts`, `logger.ts` |

---

## 3. Vista de capas — Frontend

```
┌─────────────── SPA (Vite + React 18) ───────────────────────┐
│                                                               │
│   main.tsx                                                    │
│     └── <Providers>                                          │
│           ├── QueryClientProvider (TanStack Query)           │
│           └── <BrowserRouter>                                │
│                 └── <App>                                    │
│                       └── Routes (react-router-dom v6)       │
│                                                               │
│   Pages (features/*/pages/)                                  │
│     └── Organisms (features/*/components/)                   │
│           └── Molecules (features/*/components/UserForm/…)   │
│                 └── Atoms (shared/ui/Button, Input, Field…)  │
│                                                               │
│   Hooks de servidor (TanStack Query)                         │
│     useUsers / useMe / useAssignments                        │
│       └── Services (usersService, authService, etc.)         │
│             └── httpClient (fetch + interceptor 401/refresh) │
│                   └── API REST (apps/api)                    │
│                                                               │
│   Estado de cliente (Zustand)                                │
│     useAuthStore → { accessToken, user }                     │
│       (solo en memoria — nunca localStorage)                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Separación de estado

| Tipo de estado | Herramienta | Dónde vive |
|---|---|---|
| Estado del servidor (datos API) | TanStack Query | En caché de QueryClient; invalidado por mutaciones |
| Estado de sesión (token + usuario) | Zustand (`useAuthStore`) | En memoria del proceso; se pierde al refrescar página |
| Estado de formularios | React local state (`useState`) | En el componente |

---

## 4. Módulos del backend

### `modules/auth`

Gestiona el ciclo de vida de sesión: login, emisión de tokens, rotación de refresh token, logout y obtención del usuario autenticado (`/me`).

Dependencias externas: `PrismaClient` (users + refreshTokens), `bcrypt`, `jsonwebtoken`.

### `modules/users`

CRUD completo de usuarios: creación con asignaciones iniciales opcionales, listado paginado con filtros, actualización de datos, activación/desactivación y reset de contraseña por admin.

Al desactivar un usuario, el servicio revoca todos sus refresh tokens activos via `refreshTokens.revokeAllForUser()`. Al hacer un reset de contraseña, también revoca todos los tokens para forzar re-autenticación en todos los dispositivos.

### `modules/assignments`

Gestión de la tabla de unión `user_stores` (asignaciones usuario-tienda). Protege contra la eliminación de la última asignación activa sin confirmación explícita (`?confirm=true`). Los administradores globales no pueden tener asignaciones de tienda.

### `modules/auditing`

Servicio de auditoría compartido. Expone una única función `write(input)` que persiste el evento en `audit_logs` de forma asíncrona mediante `setImmediate`, garantizando que las fallas de auditoría no afecten el ciclo de vida del request.

---

## 5. Inyección de dependencias — patrón `buildXxx({ deps })`

La inyección de dependencias se implementa mediante funciones constructoras que reciben sus dependencias como un objeto nombrado:

```typescript
// repositories
const usersRepo = buildUserRepository(db);
const refreshRepo = buildRefreshTokenRepository(db);

// service recibe sus repos como deps
const usersService = buildUserService({ users: usersRepo, refreshTokens: refreshRepo });

// controller recibe el service
const usersController = buildUserController(usersService);

// router recibe el controller
const usersRouter = buildUsersRouter(usersController);
```

Ventajas de este patrón:
- **Testabilidad:** en las pruebas unitarias, se pasan mocks de repositorio directamente al servicio, sin necesidad de patching de módulos ni contenedores IoC.
- **Legibilidad:** las dependencias son visibles en la firma de la función; no hay magia de decoradores ni reflexión.
- **Sin framework de DI:** no se agrega una dependencia adicional al proyecto.

---

## 6. Flujo de autenticación

```
Cliente                          Servidor
  │                                  │
  │── POST /api/v1/auth/login ───────►│
  │   { email, password }            │ verifica credenciales
  │                                  │ emite access token (JWT, 15min)
  │                                  │ emite refresh token (opaque, 7d)
  │◄─ 200 { accessToken, user } ─────│
  │   Set-Cookie: refreshToken=...   │ (httpOnly, SameSite=Strict)
  │                                  │
  │── GET /api/v1/... ───────────────►│
  │   Authorization: Bearer <at>     │ authGuard verifica JWT
  │◄─ 200 { datos }  ────────────────│
  │                                  │
  │── GET /api/v1/... ───────────────►│ (access token expirado)
  │   Authorization: Bearer <at>     │ authGuard: TokenExpiredError
  │◄─ 401 AUTH_TOKEN_EXPIRED ────────│
  │                                  │
  │ interceptor 401 en httpClient    │
  │── POST /api/v1/auth/refresh ─────►│
  │   Cookie: refreshToken=...       │ verifica hash, rota token
  │◄─ 200 { accessToken } ───────────│
  │   Set-Cookie: refreshToken=...   │ (nuevo token)
  │                                  │
  │── GET /api/v1/... (retry) ───────►│ con el nuevo access token
  │◄─ 200 { datos }  ────────────────│
  │                                  │
  │── POST /api/v1/auth/logout ──────►│
  │   Cookie: refreshToken=...       │ revoca el refresh token
  │◄─ 204  ──────────────────────────│
  │   Set-Cookie: refreshToken=; max-age=0 │
```

**Detección de replay:** si un refresh token ya revocado es presentado, el servidor llama a `refreshTokens.revokeFamily(token.id)`, revocando todo el árbol de tokens derivados de ese token original. Esto neutraliza un posible acceso con un refresh token robado.

---

## 7. Flujo de auditoría

```
Request llega a Express
    │
    ▼
attachAuditEmitter (middleware)
    │ req.app.locals.auditService = auditService
    ▼
Controller maneja el request
    │
    ├── operación exitosa:
    │     emitAudit(req, { action, entity, entityId, payload })
    │         │
    │         └── auditService.write(input)
    │               │
    │               └── setImmediate(() => db.auditLog.create(…))
    │                     ↑ fire-and-forget — no bloquea el request
    │
    └── res.json(…)  ← el cliente ya recibió la respuesta
                          antes de que el setImmediate se ejecute
```

Los eventos de auditoría emitidos en Feature 001 son:

| Acción | Disparador |
|--------|-----------|
| `AUTH_LOGIN_SUCCESS` | Login exitoso |
| `AUTH_LOGIN_FAILURE` | Credenciales inválidas o usuario inactivo |
| `AUTH_LOGOUT` | Logout (con o sin token) |
| `AUTH_REFRESH_TOKEN_REPLAY` | Replay de refresh token detectado |
| `USER_CREATED` | Creación de usuario |
| `USER_UPDATED` | Actualización de datos de usuario |
| `USER_DEACTIVATED` | Desactivación de usuario |
| `USER_REACTIVATED` | Reactivación de usuario |
| `USER_PASSWORD_RESET_BY_ADMIN` | Reset de contraseña por admin |
| `ASSIGNMENT_CREATED` | Asignación usuario-tienda creada |
| `ASSIGNMENT_ROLE_CHANGED` | Rol de asignación modificado |
| `ASSIGNMENT_REMOVED` | Asignación eliminada (soft-delete) |

---

## 8. Estrategia de soft-delete

Los modelos `User` y `UserStore` implementan soft-delete mediante el campo `deletedAt DateTime?`. La extensión de Prisma (`buildSoftDeleteExtension`) intercepta `findMany` e inyecta automáticamente `{ deletedAt: null }` en el where. Para `findUnique` y `findFirst`, los repositorios añaden el filtro manualmente.

```
Registro eliminado:
  deletedAt = 2026-04-25T12:00:00Z
  isActive  = false (en el caso de User)

findMany → soft-delete extension → { where: { deletedAt: null, …} }
findUnique → el repositorio agrega { where: { id, deletedAt: null } }
```

`RefreshToken` no tiene `deletedAt`; sus registros expirados se eliminan físicamente por el cron `refreshTokenCleanup` cada 24 horas (retención: 30 días).

---

## 9. Multi-tenancy

Surmoda Inventory es una arquitectura **single-tenant**. No se implementa aislamiento de datos por organización o por empresa. La separación de ámbito de datos se hace a nivel de sede (store), no a nivel de tenant. Esta decisión simplifica el modelo de datos y la arquitectura de seguridad para el alcance del proyecto de grado.

---

## 10. Roadmap — Features 002-009

Las siguientes features están planificadas. Se indica en qué decisiones arquitectónicas de la Feature 001 se apoyan.

| Feature | Descripción | Apoya en |
|---------|-------------|---------|
| **002 — Tiendas** | Alta y listado de sucursales + almacén. Agrega el modelo `Store` y materializa la relación `UserStore → Store`. | La tabla `user_stores` ya tiene `storeId`; solo se agrega la FK. |
| **003 — Productos y variantes** | Catálogo con código corto de producto (`MXS123DSA`), variantes (talla + color) con barcode único, precio opcional, imagen opcional. | Nuevos módulos `products` y `variants` siguiendo el mismo patrón de capas. |
| **004 — Inventario por sede** | Stock por sede (`Store + Variant → quantity`). CRUD con movimientos. | El módulo `auditing` ya registra eventos; los movimientos de inventario usarán la misma infraestructura. |
| **005 — Entregas** | Transferencia de variantes del almacén a una tienda. Decrementa almacén, incrementa tienda (crea si no existe). | Composición de repositorios de inventario; transacción Prisma (`$transaction`). |
| **006 — Ventas** | Scanner de barcode, selección de método de pago (QR / tarjeta / efectivo), decremento de stock. | El `roleGuard` con `storeId` resuelto del body ya maneja el ámbito de tienda. |
| **007 — Cierre de día** | Reporte diario inmutable con desglose por método de pago. Cron de cierre automático a medianoche. | El patrón de `startRefreshTokenCleanup` (setInterval) se reutiliza para el cron de cierre. |
| **008 — Reportes semanales** | Dashboard agregado para admin. Vista de ventas por tienda, por producto, por período. | Sin nuevas dependencias arquitectónicas; agrega queries de agregación sobre los modelos existentes. |
| **009 — PWA offline-first** | Service Worker, sincronización en segundo plano, escaneo de barcode nativo. | Vite 5 tiene soporte de PWA via `vite-plugin-pwa`; arquitectura FE ya es SPA. |
