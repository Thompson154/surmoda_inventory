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

## Endpoint de salud

### GET /health

No requiere autenticación. Usado por balanceadores de carga y checks de CI.

**Respuesta exitosa — 200:**
```json
{ "status": "ok" }
```
