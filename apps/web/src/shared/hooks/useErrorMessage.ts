import type { HttpError } from '@/shared/services/httpClient';
import { ERROR_CODES } from '@surmoda/contracts';

type ErrorCodeKey = keyof typeof ERROR_CODES;

const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.VALIDATION_ERROR]: 'Revisá los campos del formulario.',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
  [ERROR_CODES.INTERNAL_ERROR]: 'Error interno del servidor. Intentá de nuevo más tarde.',

  [ERROR_CODES.AUTH_LOGIN_INVALID_CREDENTIALS]: 'Email o contraseña incorrectos.',
  [ERROR_CODES.AUTH_LOGIN_USER_INACTIVE]: 'Tu cuenta está inactiva. Contactá al administrador.',
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Tu sesión expiró. Volvé a iniciar sesión.',
  [ERROR_CODES.AUTH_TOKEN_INVALID]: 'Token de acceso inválido. Volvé a iniciar sesión.',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_NOT_FOUND]: 'Sesión no encontrada. Volvé a iniciar sesión.',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_REVOKED]: 'Sesión revocada. Volvé a iniciar sesión.',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED]: 'Sesión expirada. Volvé a iniciar sesión.',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_REPLAY]: 'Token reutilizado. Volvé a iniciar sesión.',
  [ERROR_CODES.AUTH_FORBIDDEN_STORE]: 'No tenés acceso a esa tienda.',
  [ERROR_CODES.AUTH_FORBIDDEN_ROLE]: 'No tenés el rol necesario para realizar esta acción.',

  [ERROR_CODES.USER_CREATE_DUPLICATE_EMAIL]: 'Ya existe un usuario con ese email.',
  [ERROR_CODES.USER_DEACTIVATE_LAST_ADMIN]:
    'No se puede desactivar/demoter al último admin activo.',
  [ERROR_CODES.USER_NOT_FOUND]: 'Usuario no encontrado.',
  [ERROR_CODES.USER_PASSWORD_TOO_SHORT]: 'La contraseña es demasiado corta.',
  [ERROR_CODES.USER_PASSWORD_RESET_BY_ADMIN]: 'La contraseña fue restablecida por un administrador.',

  [ERROR_CODES.ASSIGNMENT_DUPLICATE]: 'Ya tiene una asignación activa en esa tienda.',
  [ERROR_CODES.ASSIGNMENT_NOT_FOUND]: 'Asignación no encontrada.',
  [ERROR_CODES.ASSIGNMENT_LAST_REMOVAL_REQUIRES_CONFIRM]:
    'Esta es la última asignación. Confirmá si querés que el usuario quede sin acceso a tiendas.',
  [ERROR_CODES.ASSIGNMENT_STORE_NOT_FOUND]: 'Tienda no encontrada.',
  [ERROR_CODES.ASSIGNMENT_INVALID_FOR_ADMIN]: 'Los administradores no pueden tener asignaciones de tienda.',

  [ERROR_CODES.STORE_NOT_FOUND]: 'Tienda no encontrada.',
  [ERROR_CODES.STORE_DUPLICATE_CODE]: 'Ese código ya está en uso.',
  [ERROR_CODES.STORE_HAS_ACTIVE_ASSIGNMENTS]:
    'Reasigná o desactivá los usuarios asignados antes de desactivar la tienda.',
  [ERROR_CODES.STORE_WAREHOUSE_ALREADY_EXISTS]: 'Solo puede existir un almacén central activo.',
  [ERROR_CODES.STORE_KIND_INVALID]: 'Tipo de tienda inválido.',
} satisfies Record<(typeof ERROR_CODES)[ErrorCodeKey], string>;

const DEFAULT_MESSAGE = 'No pudimos completar la operación.';

export function useErrorMessage(
  error: HttpError | null | undefined,
  fallback?: string,
): string | null {
  if (error == null) return null;

  const code = error.code;
  if (code === undefined) return fallback ?? DEFAULT_MESSAGE;

  return ERROR_MESSAGES[code] ?? fallback ?? DEFAULT_MESSAGE;
}
