# 02 — Marco Teórico

Este documento presenta los fundamentos técnicos sobre los que se apoya el diseño e implementación de Surmoda Inventory. Para cada concepto se indica su referencia bibliográfica, que se lista completa en [09-bibliografia.md](./09-bibliografia.md).

---

## 1. Clean Architecture y Arquitectura Hexagonal

Robert C. Martin (2017) define la **Clean Architecture** como un conjunto de principios de organización del código cuyo objetivo es la separación de responsabilidades en capas concéntricas: entidades de dominio en el centro, casos de uso alrededor, adaptadores de interfaz (controladores, presentadores) en la siguiente capa y, en el exterior, frameworks e infraestructura. La regla fundamental es que las dependencias solo pueden apuntar hacia adentro: las capas externas conocen a las internas, nunca al revés.

Alistair Cockburn (2005) propone la **Arquitectura Hexagonal** (también llamada Ports and Adapters) como una variante que hace explícito el contrato entre el dominio y el mundo exterior a través de puertos (interfaces) y adaptadores (implementaciones concretas). La inversión de dependencias de SOLID (Principio D) es el mecanismo que posibilita esto: los servicios de alto nivel dependen de abstracciones, no de implementaciones.

En Surmoda Inventory, esta filosofía se materializa en la **raíz de composición** (`composition.ts`): una única función `buildComposition()` que instancia repositorios, servicios y controladores inyectando las dependencias como parámetros tipados. Ningún servicio importa directamente otro servicio ni el cliente Prisma; todos reciben sus dependencias a través de la firma de la función constructora (`buildXxx({ deps })`). Esto permite sustituir cualquier implementación en pruebas sin necesidad de mocks globales ni patching de módulos.

**Referencia:** Martin, R. C. (2017). *Clean Architecture*. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 2. Domain-Driven Design (lite)

Eric Evans (2003) introdujo el concepto de **Bounded Context** para delimitar el alcance dentro del cual un modelo de dominio tiene significado consistente. En sistemas de tamaño medio es habitual aplicar una versión simplificada (DDD lite) que retiene los contextos acotados y el lenguaje ubicuo sin la infraestructura completa de agregados y repositorios CQRS.

En Surmoda Inventory, los módulos bajo `apps/api/src/modules/` representan contextos acotados independientes:

| Módulo | Responsabilidad de dominio |
|--------|---------------------------|
| `auth` | Autenticación, emisión y rotación de tokens |
| `users` | Ciclo de vida de usuarios (alta, baja, contraseña) |
| `assignments` | Asignación de roles de usuario a tiendas |
| `auditing` | Registro inmutable de eventos del sistema |

Cada módulo expone su propia carpeta con `service.ts`, `repository.ts`, `controller.ts`, `routes.ts`, `types.ts` y `validators.ts`. Las dependencias cruzadas entre módulos se resuelven únicamente a través de interfaces, nunca importando implementaciones directamente.

**Referencia:** Evans, E. (2003). *Domain-Driven Design*. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 3. Diseño de API REST

Roy Fielding (2000) definió **REST** (Representational State Transfer) como un estilo arquitectónico para sistemas distribuidos basado en seis restricciones: cliente-servidor, sin estado, caché, interfaz uniforme, sistema en capas y código bajo demanda (opcional). La interfaz uniforme incluye la identificación de recursos en la URI, la manipulación de recursos a través de representaciones y la autodescribilidad de los mensajes.

Surmoda Inventory implementa una API REST orientada a recursos sobre el prefijo `/api/v1`. Los recursos principales son `/auth`, `/users` y `/users/:userId/assignments`. Los códigos de estado HTTP siguen las semánticas estándar: 200 para lecturas exitosas, 201 para creaciones, 204 para operaciones sin cuerpo de respuesta (logout, password-reset, delete), 400 para errores de validación, 401 para no autenticado, 403 para no autorizado, 404 para recurso no encontrado y 409 para conflictos de negocio. Todos los errores retornan un objeto `{ code: ErrorCode, message: string }` donde `ErrorCode` es una constante tipada definida en `@surmoda/contracts`.

**Referencia:** Fielding, R. T. (2000). *Architectural Styles and the Design of Network-based Software Architectures*. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 4. JWT y Refresh Tokens

La especificación **RFC 7519** define JSON Web Token (JWT) como un medio compacto y auto-contenido para transmitir claims entre partes como un objeto JSON firmado. En esquemas de autenticación web modernos se combina con una estrategia de *refresh token* para equilibrar seguridad (tokens de corta duración) con experiencia de usuario (sesión persistente).

La implementación en Surmoda Inventory sigue el patrón de **token rotation con detección de replay** (OWASP):

1. Al hacer login, el servidor emite un *access token* JWT firmado (duración: 15 minutos, configurable via `ACCESS_TOKEN_TTL_MIN`) que viaja en el header `Authorization: Bearer <token>` y solo se almacena en memoria del cliente (nunca en `localStorage`).
2. Simultáneamente emite un *refresh token opaco* (128 bytes de entropía, SHA-256 hash almacenado en BD) en una cookie `HttpOnly; SameSite=Strict; Secure` con duración de 7 días (`REFRESH_TOKEN_TTL_DAYS`).
3. Al expirar el access token, el cliente realiza `POST /api/v1/auth/refresh`. El servidor verifica el hash del refresh token, revoca el anterior y emite un nuevo par (token rotation).
4. Si un refresh token ya revocado es presentado nuevamente (replay), el servidor revoca toda la familia de tokens asociada (`parentTokenId`) para neutralizar posibles sesiones secuestradas.

El `httpClient` del frontend implementa el interceptor: ante un 401, intenta refresh; si el refresh falla, limpia el estado de auth y redirige al login. El refresco se deduplica con una promesa en vuelo (`refreshInflight`) para evitar múltiples requests concurrentes.

**Referencia:** Jones, M. (2015). RFC 7519 — JSON Web Token. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 5. RBAC — Control de Acceso Basado en Roles

**RBAC** (Role-Based Access Control) es un modelo de control de acceso en el que los permisos se asignan a roles, y los roles a usuarios, en lugar de asignar permisos directamente a usuarios (NIST SP 800-162, 2014). Esto simplifica la administración en organizaciones donde múltiples usuarios comparten el mismo conjunto de responsabilidades.

Surmoda Inventory implementa tres roles:

| Rol | Ámbito | Capacidades |
|-----|--------|-------------|
| `admin` | Global (flag `isAdmin = true` en `User`) | Todo: CRUD usuarios, asignaciones, inventario, reportes |
| `encargada` | Por tienda (registro en `UserStore`) | Inventario de sus tiendas, entregas, movimientos, cierre de caja |
| `vendedora` | Por tienda (registro en `UserStore`) | Solo registro de ventas en su tienda asignada |

El middleware `authGuard` verifica y decodifica el JWT en cada request. El middleware `roleGuard` evalúa si el usuario autenticado tiene el rol requerido para el recurso solicitado; para rutas con ámbito de tienda, resuelve el `storeId` del request y consulta la tabla `user_stores` para verificar la asignación. Los administradores globales pasan cualquier `roleGuard` sin verificación de tienda.

**Referencia:** Ferraiolo, D. et al. (2007). *Role-Based Access Control (2nd ed.)*. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 6. Atomic Design (Brad Frost)

Brad Frost (2016) propone **Atomic Design** como una metodología para construir sistemas de diseño componibles, análoga a la química: los elementos más simples (átomos) se combinan para formar estructuras más complejas (moléculas, organismos, plantillas, páginas).

Surmoda Inventory aplica Atomic Design en el frontend (`apps/web/src/`):

- **Átomos** (`shared/ui/`): `Button`, `Input`, `Field`, `Select`, `Modal`, `Alert`. Componentes sin lógica de negocio, parametrizados por props.
- **Moléculas** (`features/*/components/UserForm/`): `EmailField`, `FullNameField`, `PasswordField`, `AdminToggle`. Combinan un átomo `Field` + `Input` con lógica de validación específica.
- **Organismos** (`features/*/components/UserForm/index.tsx`, `AssignmentsManager/`): formularios completos con estado propio.
- **Páginas** (`features/*/pages/`): `LoginPage`, `UsersListPage`, `UserCreatePage`, `UserDetailPage`. Componen organismos con hooks de datos.

Este esquema garantiza que los primitivos de UI sean reutilizables entre features sin acoplar lógica de negocio a la presentación.

**Referencia:** Frost, B. (2016). *Atomic Design*. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 7. Única fuente de verdad mediante paquetes compartidos

En arquitecturas que separan frontend y backend como aplicaciones distintas, los tipos de la API se duplican fácilmente y se dessincronizan. La solución habitual es un paquete compartido de tipos que ambas aplicaciones consumen como dependencia.

El paquete `packages/contracts` (`@surmoda/contracts`) es la única fuente de verdad para:
- Interfaces de request/response de la API (`LoginCredentials`, `LoginResponse`, `User`, `PaginatedUsers`, etc.)
- El enum `Role` compartido entre BE y FE
- El objeto `ERROR_CODES` con todos los códigos de error tipados como `as const`

Esto elimina la posibilidad de que el frontend maneje un código de error que el backend no emite, o que los tipos de respuesta difieran. El mapeo en Jest y Vitest (`moduleNameMapper`) resuelve el paquete directamente al código TypeScript fuente durante las pruebas, evitando un paso de build intermedio.

**Referencia:** Wieruch, R. (2020). *The Road to React*. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 8. Pirámide de pruebas

Mike Cohn (2009) introduce la **pirámide de pruebas** como guía sobre la proporción relativa de tipos de prueba: muchas pruebas unitarias (rápidas, aisladas), menos pruebas de integración (con dependencias reales) y pocas pruebas end-to-end (lentas, frágiles). La pirámide orienta la inversión en pruebas hacia el nivel donde el feedback es más rápido y los errores son más económicos de corregir.

Surmoda Inventory implementa los tres niveles:

1. **Pruebas unitarias BE** (Jest + ts-jest, `src/**/__tests__/**/*.spec.ts`): servicios y middlewares probados con mocks de repositorios. 71 pruebas en esta iteración.
2. **Pruebas de integración BE** (Jest + Supertest, `tests/integration/**/*.spec.ts`): contra una base de datos PostgreSQL real de test.
3. **Pruebas de componente FE** (Vitest + Testing Library + MSW, `src/**/__tests__/**/*.spec.tsx`): componentes React probados en jsdom con handlers MSW que simulan la API. 36 pruebas en esta iteración.

**Referencia:** Cohn, M. (2009). *Succeeding with Agile*. Beck, K. (2002). *Test-Driven Development: By Example*. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 9. TypeScript strict mode e isolatedModules

TypeScript con `"strict": true` activa un conjunto de verificadores de tipo que detectan en tiempo de compilación clases enteras de errores en runtime: `strictNullChecks` (evita el error de null/undefined más común en JavaScript), `noImplicitAny` (fuerza tipado explícito), `strictFunctionTypes` (varianza correcta en funciones), entre otros.

El proyecto extiende strict con opciones adicionales en `tsconfig.base.json`:

```json
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"noImplicitOverride": true,
"noUncheckedIndexedAccess": true,
"isolatedModules": true
```

`"isolatedModules": true` es especialmente relevante para el pipeline de CI: garantiza que cada archivo TypeScript pueda ser transformado de forma aislada (requisito de ts-jest y Vitest), sin depender de información de tipos globales que podrían no estar disponibles en un contexto de transformación rápida.

**Referencia:** Cherny, B. (2019). *Programming TypeScript*. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 10. Monorepo con npm workspaces

Un **monorepo** es un único repositorio Git que aloja múltiples proyectos relacionados. npm workspaces (disponible desde npm 7 / Node 16) permite declarar múltiples paquetes en el campo `"workspaces"` del `package.json` raíz; npm los enlaza simbólicamente en `node_modules` y permite correr scripts en todos los workspaces con un único comando.

En Surmoda Inventory, el monorepo contiene:
- `apps/api` — backend
- `apps/web` — frontend
- `packages/contracts` — tipos compartidos

Esto simplifica el desarrollo: un solo `npm install`, un solo `package-lock.json`, un solo pipeline CI y la posibilidad de referenciar `@surmoda/contracts` directamente desde el código fuente de `apps/api` y `apps/web` sin publicarlo a un registro npm.

**Referencia:** Lage, N. (2023). *Monorepo Handbook*. Ver [09-bibliografia.md](./09-bibliografia.md).

---

## 11. Soft-delete

El patrón de **soft-delete** (borrado lógico) consiste en marcar un registro como eliminado (campo `deletedAt`) en lugar de borrarlo físicamente de la base de datos. Esto preserva la integridad referencial, mantiene el historial de auditoría y permite restaurar registros accidentalmente eliminados.

En Surmoda Inventory, los modelos `User` y `UserStore` tienen un campo `deletedAt DateTime?`. La implementación utiliza una **extensión de Prisma Client** (`buildSoftDeleteExtension` en `infrastructure/database.ts`) que intercepta automáticamente todas las llamadas `findMany` para los modelos afectados e inyecta el filtro `deletedAt: null`. Para `findUnique` y `findFirst`, los repositorios agregan el filtro explícitamente para preservar la semántica del contrato de clave única de Prisma. El modelo `RefreshToken` no aplica soft-delete; sus registros se eliminan físicamente por el cron de limpieza (`refreshTokenCleanup`).

**Referencia:** Percival, H. & Gregory, B. (2020). *Architecture Patterns with Python*. Ver [09-bibliografia.md](./09-bibliografia.md).
