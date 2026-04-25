# 06 — Referencia de la API REST

**Base URL:** `http://localhost:3000/api/v1` (desarrollo) / `https://<dominio>/api/v1` (producción)

**Autenticación:** Bearer token en header `Authorization: Bearer <accessToken>`.

**Formato de errores:**
```json
{ "code": "ERROR_CODE", "message": "Descripción legible" }
```

**Códigos de error disponibles** (definidos en `@surmoda/contracts`):
- Globales: `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`
- Auth: `AUTH_LOGIN_INVALID_CREDENTIALS`, `AUTH_LOGIN_USER_INACTIVE`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`, `AUTH_REFRESH_TOKEN_NOT_FOUND`, `AUTH_REFRESH_TOKEN_REVOKED`, `AUTH_REFRESH_TOKEN_EXPIRED`, `AUTH_REFRESH_TOKEN_REPLAY`, `AUTH_FORBIDDEN_ROLE`, `AUTH_FORBIDDEN_STORE`
- Usuarios: `USER_NOT_FOUND`, `USER_CREATE_DUPLICATE_EMAIL`, `USER_DEACTIVATE_LAST_ADMIN`, `USER_PASSWORD_TOO_SHORT`, `USER_PASSWORD_RESET_BY_ADMIN`
- Asignaciones: `ASSIGNMENT_DUPLICATE`, `ASSIGNMENT_NOT_FOUND`, `ASSIGNMENT_LAST_REMOVAL_REQUIRES_CONFIRM`, `ASSIGNMENT_STORE_NOT_FOUND`, `ASSIGNMENT_INVALID_FOR_ADMIN`
- Tiendas: `STORE_NOT_FOUND`, `STORE_DUPLICATE_CODE`, `STORE_HAS_ACTIVE_ASSIGNMENTS`, `STORE_WAREHOUSE_ALREADY_EXISTS`, `STORE_KIND_INVALID`
- Productos / variantes: `PRODUCT_NOT_FOUND`, `PRODUCT_DUPLICATE_CODE`, `PRODUCT_HAS_ACTIVE_VARIANTS`, `VARIANT_NOT_FOUND`, `VARIANT_PRODUCT_NOT_FOUND`, `VARIANT_DUPLICATE_TUPLE`, `VARIANT_PRICE_REQUIRED`, `VARIANT_IMAGE_TOO_LARGE`, `VARIANT_IMAGE_INVALID_TYPE`, `VARIANT_IMMUTABLE_FIELD`, `BARCODE_COLLISION`

---

## Auth

### POST /api/v1/auth/login

Inicia sesión. Emite access token (JWT) y refresh token (cookie httpOnly).

**Rate limit:** 10 requests/minuto por IP (configurable via `RATE_LIMIT_LOGIN_PER_MIN`).

**Autenticación requerida:** No

**Request body:**
```typescript
{
  email: string;    // normalizado a minúsculas
  password: string; // mínimo 1 carácter
}
```

**Respuesta exitosa — 200:**
```typescript
{
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    isAdmin: boolean;
    assignments: Array<{ storeId: string; role: "encargada" | "vendedora" }>;
  }
}
```
Además: `Set-Cookie: refreshToken=<opaque>; HttpOnly; SameSite=Strict; Secure; Path=/api/v1/auth; Max-Age=<7d en ms>`

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Email inválido o password vacío |
| 401 | `AUTH_LOGIN_INVALID_CREDENTIALS` | Email no existe o contraseña incorrecta |
| 403 | `AUTH_LOGIN_USER_INACTIVE` | Usuario desactivado |
| 429 | `RATE_LIMIT_EXCEEDED` | Demasiados intentos |

**Auditoría emitida:**
- Éxito: `AUTH_LOGIN_SUCCESS` (entity: `User`, entityId: userId)
- Fallo: `AUTH_LOGIN_FAILURE` (payload: `{ reason }`)

---

### POST /api/v1/auth/refresh

Rota el refresh token y emite un nuevo access token.

**Rate limit:** 30 requests/minuto por IP.

**Autenticación requerida:** No (se lee de la cookie `refreshToken`)

**Request body:** ninguno

**Respuesta exitosa — 200:**
```typescript
{
  accessToken: string;
}
```
Además: `Set-Cookie: refreshToken=<nuevo_opaque>; …` (mismo formato, nueva expiración)

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 401 | `AUTH_TOKEN_INVALID` | Cookie ausente o malformada |
| 401 | `AUTH_REFRESH_TOKEN_NOT_FOUND` | Token no existe en BD |
| 401 | `AUTH_REFRESH_TOKEN_EXPIRED` | Token expirado |
| 401 | `AUTH_REFRESH_TOKEN_REPLAY` | Token revocado presentado de nuevo (familia revocada) |
| 403 | `AUTH_LOGIN_USER_INACTIVE` | Usuario desactivado |

**Auditoría emitida:**
- Replay detectado: `AUTH_REFRESH_TOKEN_REPLAY` (entity: `RefreshToken`)

---

### POST /api/v1/auth/logout

Revoca el refresh token activo y elimina la cookie.

**Autenticación requerida:** No (opera sobre la cookie; es idempotente)

**Request body:** ninguno

**Respuesta exitosa — 204:** sin cuerpo. `Set-Cookie: refreshToken=; Max-Age=0`

**Errores posibles:** ninguno observable por el cliente (siempre 204)

**Auditoría emitida:** `AUTH_LOGOUT` (entity: `User`, userId del token si estaba autenticado)

---

### GET /api/v1/auth/me

Devuelve el usuario autenticado actualmente.

**Autenticación requerida:** Sí (Bearer token)

**Request body:** ninguno

**Respuesta exitosa — 200:**
```typescript
{
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  assignments: Array<{ storeId: string; role: "encargada" | "vendedora" }>;
}
```

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 401 | `AUTH_TOKEN_INVALID` | Token ausente o malformado |
| 401 | `AUTH_TOKEN_EXPIRED` | Token expirado |
| 403 | `AUTH_LOGIN_USER_INACTIVE` | Usuario fue desactivado después de emitir el token |

---

## Usuarios

Todas las rutas de usuarios requieren autenticación y rol admin.

**Autenticación requerida:** Sí (Bearer token)
**Rol requerido:** Admin (`isAdmin = true`)

### GET /api/v1/users

Lista usuarios con paginación y filtros opcionales.

**Query params:**
```typescript
{
  q?: string;        // búsqueda por nombre o email
  isActive?: boolean;
  isAdmin?: boolean;
  page?: number;     // default: 1
  pageSize?: number; // default: 20, máximo: 100
}
```

**Respuesta exitosa — 200:**
```typescript
{
  items: Array<{
    id: string;
    email: string;
    fullName: string;
    isAdmin: boolean;
    isActive: boolean;
    assignmentsCount: number;
    createdAt: string; // ISO 8601
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

---

### POST /api/v1/users

Crea un nuevo usuario.

**Request body:**
```typescript
{
  email: string;           // normalizado a minúsculas
  password: string;        // mínimo 8 caracteres
  fullName: string;        // máx. 120 caracteres
  isAdmin?: boolean;       // default: false
  assignments?: Array<{    // requerido si isAdmin = false
    storeId: string;
    role: "encargada" | "vendedora";
  }>;
}
```

**Regla de validación cross-field:**
- Si `isAdmin = false`: `assignments` debe tener al menos un elemento.
- Si `isAdmin = true`: `assignments` debe estar vacío o ausente.

**Respuesta exitosa — 201:**
```typescript
{
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  assignments: Array<{ id: string; storeId: string; role: "encargada" | "vendedora" }>;
  createdAt: string;
  updatedAt: string;
}
```

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Campos inválidos o regla cross-field violada |
| 409 | `USER_CREATE_DUPLICATE_EMAIL` | Email ya registrado |

**Auditoría emitida:** `USER_CREATED` (payload: `{ email, isAdmin, assignmentsCount }`)

---

### GET /api/v1/users/:id

Obtiene un usuario por ID con sus asignaciones activas.

**Respuesta exitosa — 200:** misma forma que `POST /api/v1/users` (201)

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 404 | `USER_NOT_FOUND` | Usuario no existe o está soft-deleted |

---

### PATCH /api/v1/users/:id

Actualiza datos de un usuario.

**Request body (todos los campos son opcionales):**
```typescript
{
  fullName?: string; // máx. 120 caracteres
  isAdmin?: boolean;
}
```

**Regla de negocio:** no se puede demotar (`isAdmin: false`) al último admin activo del sistema.

**Respuesta exitosa — 200:** misma forma que `GET /api/v1/users/:id`

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Campos inválidos |
| 404 | `USER_NOT_FOUND` | Usuario no existe |
| 409 | `USER_DEACTIVATE_LAST_ADMIN` | Intento de demotar al último admin |

**Auditoría emitida:** `USER_UPDATED` (payload: `{ fullName, isAdmin }`)

---

### POST /api/v1/users/:id/deactivate

Desactiva un usuario. Idempotente si ya estaba inactivo.

**Request body:** ninguno

**Respuesta exitosa — 200:** estado del usuario actualizado (mismo formato que GET).

**Efecto secundario:** revoca todos los refresh tokens del usuario.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 404 | `USER_NOT_FOUND` | Usuario no existe |
| 409 | `USER_DEACTIVATE_LAST_ADMIN` | Intento de desactivar al último admin |

**Auditoría emitida:** `USER_DEACTIVATED`

---

### POST /api/v1/users/:id/reactivate

Reactiva un usuario desactivado. Idempotente si ya estaba activo.

**Request body:** ninguno

**Respuesta exitosa — 200:** estado del usuario actualizado.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 404 | `USER_NOT_FOUND` | Usuario no existe |

**Auditoría emitida:** `USER_REACTIVATED`

---

### POST /api/v1/users/:id/password-reset

Permite a un admin resetear la contraseña de cualquier usuario.

**Request body:**
```typescript
{
  newPassword: string; // mínimo 8 caracteres
}
```

**Respuesta exitosa — 204:** sin cuerpo.

**Efecto secundario:** revoca todos los refresh tokens del usuario, forzando re-autenticación en todos los dispositivos.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Contraseña demasiado corta |
| 404 | `USER_NOT_FOUND` | Usuario no existe |

**Auditoría emitida:** `USER_PASSWORD_RESET_BY_ADMIN` (payload: `{ resetByAdminId }`; el plaintext NUNCA se registra)

---

## Asignaciones

Todas las rutas de asignaciones requieren autenticación y rol admin.

**Autenticación requerida:** Sí (Bearer token)
**Rol requerido:** Admin

### GET /api/v1/users/:userId/assignments

Lista las asignaciones activas de un usuario.

**Respuesta exitosa — 200:**
```typescript
{
  items: Array<{
    id: string;
    storeId: string;
    role: "encargada" | "vendedora";
  }>;
}
```

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 404 | `USER_NOT_FOUND` | Usuario no existe |

---

### POST /api/v1/users/:userId/assignments

Crea una asignación usuario-tienda.

**Request body:**
```typescript
{
  storeId: string; // mínimo 1 carácter
  role: "encargada" | "vendedora";
}
```

**Respuesta exitosa — 201:**
```typescript
{
  id: string;
  storeId: string;
  role: "encargada" | "vendedora";
}
```

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Campos inválidos |
| 400 | `ASSIGNMENT_INVALID_FOR_ADMIN` | El usuario es admin; no puede tener asignaciones |
| 404 | `USER_NOT_FOUND` | Usuario no existe |
| 409 | `ASSIGNMENT_DUPLICATE` | Ya existe una asignación activa para ese userId+storeId |

**Auditoría emitida:** `ASSIGNMENT_CREATED` (payload: `{ targetUserId, storeId, role }`)

---

### PATCH /api/v1/users/:userId/assignments/:assignmentId

Actualiza el rol de una asignación existente.

**Request body:**
```typescript
{
  role: "encargada" | "vendedora";
}
```

**Respuesta exitosa — 200:**
```typescript
{
  id: string;
  storeId: string;
  role: "encargada" | "vendedora";
}
```

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Rol inválido |
| 404 | `ASSIGNMENT_NOT_FOUND` | Asignación no existe o no pertenece al usuario |

**Auditoría emitida:** `ASSIGNMENT_ROLE_CHANGED` (payload: `{ targetUserId, storeId, role }`)

---

### DELETE /api/v1/users/:userId/assignments/:assignmentId?confirm=true

Elimina (soft-delete) una asignación.

**Query param:** `confirm=true` — requerido si es la última asignación activa del usuario (protege contra dejarlo sin acceso accidentalmente).

**Respuesta exitosa — 204:** sin cuerpo.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 404 | `ASSIGNMENT_NOT_FOUND` | Asignación no existe o no pertenece al usuario |
| 409 | `ASSIGNMENT_LAST_REMOVAL_REQUIRES_CONFIRM` | Es la última asignación y no se pasó `confirm=true` |

**Auditoría emitida:** `ASSIGNMENT_REMOVED` (payload: `{ targetUserId }`)

---

## Tiendas (Feature 002)

Endpoints CRUD para sedes (`Store`). Las lecturas son accesibles a cualquier usuario autenticado y aplican filtrado por RBAC (los staff sólo ven sus tiendas asignadas; los admin ven todas). Las mutaciones requieren `isAdmin = true`.

### GET /api/v1/stores

Lista las tiendas visibles para el usuario actual con paginación.

**Autenticación requerida:** Sí (cualquier rol)

**Query params:**
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `q` | `string` | — | Búsqueda en `code` (uppercased) y `name` (case-insensitive) |
| `kind` | `'warehouse' \| 'branch'` | — | Filtrado por tipo |
| `isActive` | `boolean` | admin: `true` si no se pasa `includeInactive`; staff: forzado a `true` | Filtra por estado |
| `includeInactive` | `boolean` | `false` | (Sólo admin) — incluir inactivas en el listado |
| `page` | `number` | `1` | Página (1-indexed) |
| `pageSize` | `number` | `20` (máx. `100`) | Tamaño de página |

**Respuesta exitosa — 200:**
```typescript
{
  items: Array<{
    id: string;
    code: string;
    name: string;
    kind: "warehouse" | "branch";
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

**Comportamiento RBAC:**
- **Admin:** ve todas las tiendas; respeta `isActive` y `includeInactive`.
- **Staff (encargada/vendedora):** sólo ve las tiendas activas a las que está asignada vía `UserStore`. Si no tiene asignaciones, recibe `items: []`.

---

### GET /api/v1/stores/:id

Devuelve el detalle de una tienda por id.

**Autenticación requerida:** Sí

**Comportamiento RBAC:**
- **Admin:** acceso total.
- **Staff:** sólo si tiene una asignación activa a esa tienda; en caso contrario devuelve `404 STORE_NOT_FOUND` (sin distinguir entre "no existe" y "no autorizada", para evitar leak de existencia).

**Respuesta exitosa — 200:** mismo shape que `items[]` arriba.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 404 | `STORE_NOT_FOUND` | Tienda no existe o usuario no autorizado |

---

### POST /api/v1/stores

Crea una nueva tienda. Sólo admin.

**Autenticación requerida:** Sí (admin)

**Request body:**
```typescript
{
  code: string; // 2-20 chars, [A-Z0-9_]+ (autouppercased en el servicio)
  name: string; // 2-80 chars
  kind: "warehouse" | "branch";
}
```

**Respuesta exitosa — 201:** la tienda creada.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | `code` no cumple el patrón / longitud, `name` fuera de rango, `kind` inválido |
| 403 | `AUTH_FORBIDDEN_ROLE` | Usuario no admin |
| 409 | `STORE_WAREHOUSE_ALREADY_EXISTS` | Ya existe un almacén central activo |
| 409 | `STORE_DUPLICATE_CODE` | Ya existe una tienda con ese `code` |

**Auditoría emitida:** `STORE_CREATED` (payload: `{ code, kind }`).

**Notas técnicas:**
- La invariante de almacén único se enforza en una transacción `Serializable` (count-then-insert). Bajo contención puede haber retries automáticos del cliente Prisma.

---

### PATCH /api/v1/stores/:id

Actualiza `code` y/o `name`. **`kind` es inmutable** y será rechazado por el validador con `400`.

**Autenticación requerida:** Sí (admin)

**Request body:**
```typescript
{
  code?: string; // mismo patrón que en create
  name?: string;
}
```

Al menos un campo debe estar presente.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Body vacío, formato inválido, o `kind` presente |
| 403 | `AUTH_FORBIDDEN_ROLE` | No admin |
| 404 | `STORE_NOT_FOUND` | Tienda no existe |
| 409 | `STORE_DUPLICATE_CODE` | El nuevo `code` ya está en uso por otra tienda |

**Auditoría emitida:** `STORE_UPDATED` (payload: `{ changes }`).

---

### POST /api/v1/stores/:id/deactivate

Desactiva una tienda (`isActive = false`). Idempotente.

**Autenticación requerida:** Sí (admin)

**Reglas de negocio:**
- Si existen asignaciones activas (`UserStore` con `deletedAt = null`), la operación falla con `409 STORE_HAS_ACTIVE_ASSIGNMENTS` y el campo `details.activeAssignmentsCount` indica cuántos usuarios deben ser reasignados primero.
- Si la tienda ya está inactiva, devuelve `200` con el estado actual (sin modificar).

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 403 | `AUTH_FORBIDDEN_ROLE` | No admin |
| 404 | `STORE_NOT_FOUND` | Tienda no existe |
| 409 | `STORE_HAS_ACTIVE_ASSIGNMENTS` | Hay usuarios asignados activos (ver `details.activeAssignmentsCount`) |

**Auditoría emitida:** `STORE_DEACTIVATED`.

---

### POST /api/v1/stores/:id/reactivate

Reactiva una tienda previamente desactivada. Idempotente.

**Autenticación requerida:** Sí (admin)

**Reglas de negocio:**
- Si la tienda ya está activa, devuelve `200` con el estado actual.
- Si la tienda es de tipo `warehouse` y ya existe otro almacén activo distinto, falla con `409 STORE_WAREHOUSE_ALREADY_EXISTS`.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 403 | `AUTH_FORBIDDEN_ROLE` | No admin |
| 404 | `STORE_NOT_FOUND` | Tienda no existe |
| 409 | `STORE_WAREHOUSE_ALREADY_EXISTS` | Ya hay otro almacén central activo |

**Auditoría emitida:** `STORE_REACTIVATED`.

---

## Catálogo — Productos y Variantes (Feature 003)

Endpoints CRUD para `Product` y `Variant`. Las lecturas son accesibles a cualquier usuario autenticado (admin y staff). Las mutaciones requieren `isAdmin = true`. La creación y actualización de variantes acepta una imagen opcional vía `multipart/form-data` (≤ 5 MB, MIME `image/png|jpeg|webp`).

### GET /api/v1/products

Lista los productos del catálogo con paginación.

**Query params:**
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `q` | `string` | — | Búsqueda en `code` (uppercased) y `name` (case-insensitive) |
| `isActive` | `boolean` | — | Filtra por estado |
| `includeInactive` | `boolean` | `false` | Incluir productos inactivos |
| `page` | `number` | `1` | Página (1-indexed) |
| `pageSize` | `number` | `20` (máx. `100`) | Tamaño de página |

**Respuesta exitosa — 200:**
```typescript
{
  items: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    variantsCount: number;
    createdAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

---

### GET /api/v1/products/:id

Devuelve el producto con sus variantes embebidas. Por defecto sólo variantes activas; admin puede usar `?includeInactive=true` para ver todas.

**Respuesta exitosa — 200:** `Product & { variants: Variant[] }`.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 404 | `PRODUCT_NOT_FOUND` | No existe o soft-deleted |

---

### POST /api/v1/products

Crea un nuevo producto. Solo admin.

**Request body (`application/json`):**
```typescript
{
  code: string;          // 2-15, [A-Z0-9_]+ (autouppercased)
  name: string;          // 2-120
  description?: string;  // ≤ 500
}
```

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Patrón / longitud inválidos |
| 403 | `AUTH_FORBIDDEN_ROLE` | No admin |
| 409 | `PRODUCT_DUPLICATE_CODE` | Código en uso |

**Auditoría emitida:** `PRODUCT_CREATED` (payload: `{ code, name }`).

---

### PATCH /api/v1/products/:id

Actualiza `name`, `description` y opcionalmente `code`. El validador `.strict()` rechaza campos desconocidos con 400.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Body vacío o campos desconocidos |
| 404 | `PRODUCT_NOT_FOUND` | Producto inexistente |
| 409 | `PRODUCT_DUPLICATE_CODE` | Nuevo `code` colisiona con otro producto |

**Auditoría emitida:** `PRODUCT_UPDATED`.

---

### POST /api/v1/products/:id/deactivate

Desactiva el producto. Idempotente. Bloquea si existen variantes activas.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 404 | `PRODUCT_NOT_FOUND` | — |
| 409 | `PRODUCT_HAS_ACTIVE_VARIANTS` | Hay variantes activas (ver `details.activeVariantsCount`) |

**Auditoría emitida:** `PRODUCT_DEACTIVATED`.

---

### POST /api/v1/products/:id/reactivate

Reactiva un producto inactivo. Idempotente.

**Auditoría emitida:** `PRODUCT_REACTIVATED`.

---

### POST /api/v1/products/:productId/variants

Crea una nueva variante. **Multipart/form-data** — campos del cuerpo van como text, la imagen como file.

**Form fields:**
| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `size` | `'s' \| 'm' \| 'l' \| 'xl' \| 'xxl' \| '28' \| '30' \| '32' \| '34' \| 'standard'` | sí | Talla |
| `color` | `string` | sí | Color free-form, 1-32 chars |
| `priceCents` | `number` (entero) | sí | Precio en centavos, 1 ≤ x ≤ 10_000_000 |
| `image` | `File` | no | PNG / JPEG / WebP, ≤ 5 MB |

**Generación de barcode:** El servicio computa `SHA-256(code|size|color.toLowerCase())[0..12].toUpperCase()` automáticamente. El cliente NO envía barcode.

**Respuesta exitosa — 201:** `Variant` completa con `barcode` e `imagePath` resueltos.

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Campos inválidos |
| 400 | `VARIANT_IMAGE_TOO_LARGE` | Imagen > 5 MB |
| 400 | `VARIANT_IMAGE_INVALID_TYPE` | MIME no soportado |
| 403 | `AUTH_FORBIDDEN_ROLE` | No admin |
| 404 | `VARIANT_PRODUCT_NOT_FOUND` | Producto inexistente o inactivo |
| 409 | `VARIANT_DUPLICATE_TUPLE` | Ya existe variante activa con `(size, color)` para ese producto |
| 409 | `BARCODE_COLLISION` | Conflicto residual de barcode (extremamente raro) |

**Auditoría emitida:** `VARIANT_CREATED` (payload: `{ productId, size, color, barcode, priceCents }`).

---

### PATCH /api/v1/variants/:id

Actualiza una variante. **Multipart/form-data** (sólo si re-uploadeás imagen) o JSON. Campos `size` y `color` son inmutables — el validador `.strict()` los rechaza si vienen en el body.

**Form fields permitidos:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `priceCents` | `number` | Nuevo precio en centavos |
| `image` | `File` | Nueva imagen (opcional) |

**Errores posibles:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` / `VARIANT_IMMUTABLE_FIELD` | Body vacío o intento de cambiar `size`/`color` |
| 404 | `VARIANT_NOT_FOUND` | — |

**Auditoría emitida:** `VARIANT_UPDATED`.

---

### POST /api/v1/variants/:id/deactivate

Desactiva una variante. Idempotente.

**Auditoría emitida:** `VARIANT_DEACTIVATED`.

---

### POST /api/v1/variants/:id/reactivate

Reactiva una variante. Idempotente.

**Auditoría emitida:** `VARIANT_REACTIVATED`.

---

### Acceso a imágenes locales

Cuando `IMAGE_STORAGE=local`, el backend expone el directorio configurado bajo `GET /static/images/*`. Las URLs se construyen como:

`${VITE_API_BASE_URL}/static/images/<filename>`

Cuando el modo es `cloudinary`, los `imagePath` ya son URLs absolutas (`https://res.cloudinary.com/...`) y no se sirven desde el backend.

---

## Endpoint de salud

### GET /health

No requiere autenticación. Usado por balanceadores de carga y checks de CI.

**Respuesta exitosa — 200:**
```json
{ "status": "ok" }
```
