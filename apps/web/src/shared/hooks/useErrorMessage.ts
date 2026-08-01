import { ERROR_CODES } from '@surmoda/contracts';
import type { HttpError } from '@/shared/services/httpClient';

type ErrorCodeKey = keyof typeof ERROR_CODES;

const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.VALIDATION_ERROR]: 'Revisá los campos del formulario.',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]:
    'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
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
  [ERROR_CODES.USER_PASSWORD_RESET_BY_ADMIN]:
    'La contraseña fue restablecida por un administrador.',

  [ERROR_CODES.ASSIGNMENT_DUPLICATE]: 'Ya tiene una asignación activa en esa tienda.',
  [ERROR_CODES.ASSIGNMENT_NOT_FOUND]: 'Asignación no encontrada.',
  [ERROR_CODES.ASSIGNMENT_LAST_REMOVAL_REQUIRES_CONFIRM]:
    'Esta es la última asignación. Confirmá si querés que el usuario quede sin acceso a tiendas.',
  [ERROR_CODES.ASSIGNMENT_STORE_NOT_FOUND]: 'Tienda no encontrada.',
  [ERROR_CODES.ASSIGNMENT_INVALID_FOR_ADMIN]:
    'Los administradores no pueden tener asignaciones de tienda.',

  [ERROR_CODES.STORE_NOT_FOUND]: 'Tienda no encontrada.',
  [ERROR_CODES.STORE_DUPLICATE_CODE]: 'Ese código ya está en uso.',
  [ERROR_CODES.STORE_HAS_ACTIVE_ASSIGNMENTS]:
    'Reasigná o desactivá los usuarios asignados antes de desactivar la tienda.',
  [ERROR_CODES.STORE_WAREHOUSE_ALREADY_EXISTS]: 'Solo puede existir un almacén central activo.',
  [ERROR_CODES.STORE_KIND_INVALID]: 'Tipo de tienda inválido.',

  [ERROR_CODES.PRODUCT_NOT_FOUND]: 'Producto no encontrado.',
  [ERROR_CODES.PRODUCT_DUPLICATE_CODE]: 'Ese código de producto ya está en uso.',
  [ERROR_CODES.PRODUCT_HAS_ACTIVE_VARIANTS]:
    'Desactivá las variantes activas antes de desactivar el producto.',
  [ERROR_CODES.VARIANT_NOT_FOUND]: 'Variante no encontrada.',
  [ERROR_CODES.VARIANT_PRODUCT_NOT_FOUND]: 'El producto no existe o está inactivo.',
  [ERROR_CODES.VARIANT_DUPLICATE_TUPLE]: 'Ya existe una variante con esa talla y color.',
  [ERROR_CODES.VARIANT_PRICE_REQUIRED]: 'El precio es obligatorio.',
  [ERROR_CODES.VARIANT_IMAGE_TOO_LARGE]: 'La imagen supera 5 MB.',
  [ERROR_CODES.VARIANT_IMAGE_INVALID_TYPE]: 'Formato de imagen inválido (PNG, JPG o WebP).',
  [ERROR_CODES.VARIANT_IMMUTABLE_FIELD]: 'No se puede cambiar talla ni color.',
  [ERROR_CODES.BARCODE_COLLISION]: 'Conflicto de código de barras. Intentá de nuevo.',

  [ERROR_CODES.STOCK_NOT_FOUND]: 'Inventario no encontrado.',
  [ERROR_CODES.STOCK_BARCODE_NOT_FOUND]: 'Código de barras no encontrado en esta sede.',
  [ERROR_CODES.STOCK_VENDEDORA_EDIT_DISABLED]: 'Tu encargada deshabilitó la edición de inventario.',
  [ERROR_CODES.STOCK_NEGATIVE_NOT_ALLOWED]: 'El stock no puede ser negativo.',
  [ERROR_CODES.STORE_EDIT_PERMISSION_FORBIDDEN]: 'Sólo encargada/admin puede realizar esta acción.',
  [ERROR_CODES.INVENTORY_PRODUCT_NOT_IN_STORE]: 'Este producto no tiene stock en esta sede.',
  [ERROR_CODES.STORE_FORBIDDEN]: 'No tenés acceso a esta sede.',

  [ERROR_CODES.DELIVERY_NOT_FOUND]: 'Entrega no encontrada.',
  [ERROR_CODES.DELIVERY_NO_WAREHOUSE]: 'No hay un almacén activo configurado.',
  [ERROR_CODES.DELIVERY_INSUFFICIENT_STOCK]: 'Stock insuficiente en el almacén.',
  [ERROR_CODES.DELIVERY_EMPTY_ITEMS]: 'Agregá al menos un ítem.',
  [ERROR_CODES.DELIVERY_VARIANT_NOT_FOUND]: 'Una de las variantes no existe o está inactiva.',
  [ERROR_CODES.DELIVERY_FORBIDDEN]: 'Sólo encargada/admin puede crear entregas.',
  [ERROR_CODES.DELIVERY_INVALID_STATE]:
    'No se puede aplicar esa acción al estado actual de la entrega.',

  [ERROR_CODES.SALE_NOT_FOUND]: 'Venta no encontrada.',
  [ERROR_CODES.SALE_EMPTY_ITEMS]: 'Agregá al menos un ítem.',
  [ERROR_CODES.SALE_INSUFFICIENT_STOCK]: 'Stock insuficiente en esta sede.',
  [ERROR_CODES.SALE_VARIANT_NOT_FOUND]: 'Variante no encontrada.',
  [ERROR_CODES.SALE_DASHBOARD_FORBIDDEN]: 'Sólo encargada/admin puede ver el dashboard.',
  [ERROR_CODES.SALES_LOCKED]: 'El registro de ventas está bloqueado. Cerrá el día primero.',

  [ERROR_CODES.SALES_RETURN_CREATE_INVALID_BARCODE]: 'No encontramos un producto con ese código.',
  [ERROR_CODES.SALES_RETURN_CREATE_FORBIDDEN_STORE]:
    'No tenés permiso para hacer devoluciones en esta sucursal.',
  [ERROR_CODES.SALES_RETURN_CREATE_VARIANT_NOT_IN_STORE]:
    'Esta variante no figura en el inventario de la sucursal.',

  [ERROR_CODES.DAILY_REPORT_NOT_FOUND]: 'No hay reporte cerrado para ese día.',
  [ERROR_CODES.DAILY_REPORT_FORBIDDEN]: 'Sólo encargada/admin puede cerrar el día.',

  [ERROR_CODES.SNAPSHOT_DUPLICATE]: 'Ya existe un snapshot reciente para esta sucursal.',
  [ERROR_CODES.REPORT_STORE_FORBIDDEN]: 'No tenés permiso para generar reportes de esta sucursal.',

  [ERROR_CODES.RETURN_REQUEST_CREATE_REASON_REQUIRED]: 'El motivo de la devolución es obligatorio.',
  [ERROR_CODES.RETURN_REQUEST_CREATE_INVALID_VARIANT]:
    'La variante no es válida para esta devolución.',
  [ERROR_CODES.RETURN_REQUEST_CREATE_INVALID_SALE_DATE]:
    'La fecha de venta no es válida para devolución.',
  [ERROR_CODES.RETURN_REQUEST_CREATE_FORBIDDEN_STORE]:
    'No tenés permiso para pedir devoluciones en esta sucursal.',
  [ERROR_CODES.RETURN_REQUEST_REVIEW_FORBIDDEN]: 'Solo encargada/admin puede revisar devoluciones.',
  [ERROR_CODES.RETURN_REQUEST_REVIEW_ALREADY_REVIEWED]: 'Esta devolución ya fue revisada.',
  [ERROR_CODES.RETURN_REQUEST_REVIEW_REASON_REQUIRED]: 'El motivo de la revisión es obligatorio.',
  [ERROR_CODES.DAILY_CLOSURE_RETROACTIVE_EDIT_REASON_REQUIRED]:
    'El motivo del ajuste retroactivo es obligatorio.',

  [ERROR_CODES.SALE_DISCOUNT_EXCEEDS_LIMIT]: 'El descuento no puede superar el 30%.',
  [ERROR_CODES.SALE_EDIT_FORBIDDEN_AFTER_CHARGE]: 'No se puede editar una venta ya cobrada.',
  [ERROR_CODES.INVENTORY_EDIT_FORBIDDEN_NON_ADMIN]:
    'Sólo admin puede realizar esta edición de inventario.',
  [ERROR_CODES.DELIVERY_EDIT_FORBIDDEN_NON_ADMIN]: 'Sólo admin puede editar esta entrega.',

  [ERROR_CODES.RETURN_REQUEST_CREATE_INVALID_CLOSURE]:
    'No encontramos un cierre de día para esa fecha.',
  [ERROR_CODES.RETURN_REQUEST_CREATE_ORIGINAL_SALE_NOT_FOUND]:
    'No encontramos esa venta en el cierre indicado.',
  [ERROR_CODES.RETURN_REQUEST_APPROVE_REPLACEMENT_FAILED]:
    'No pudimos aplicar el cambio. Intentá de nuevo o avisá al admin.',
  [ERROR_CODES.DELIVERY_EDIT_REQUEST_CREATE_REASON_TOO_SHORT]:
    'La justificación debe tener al menos 50 caracteres.',
  [ERROR_CODES.DELIVERY_EDIT_REQUEST_CREATE_INVALID_STATUS]:
    'Solo se pueden solicitar ediciones en entregas enviadas (no recibidas).',
  [ERROR_CODES.DELIVERY_EDIT_REQUEST_REVIEW_FORBIDDEN]:
    'No tenés permiso para revisar esta solicitud.',
  [ERROR_CODES.DELIVERY_EDIT_REQUEST_REVIEW_ALREADY_REVIEWED]: 'Esta solicitud ya fue revisada.',
  [ERROR_CODES.DELIVERY_EDIT_REQUEST_REVIEW_REASON_REQUIRED]:
    'Tenés que escribir el motivo del rechazo.',
  [ERROR_CODES.DELIVERY_RECEIVE_FORBIDDEN_VENDEDORA]:
    'Solo encargada/admin puede confirmar recepción de entrega.',
  [ERROR_CODES.DELIVERY_EDIT_REQUEST_CREATE_FORBIDDEN_STORE]:
    'No tenés permiso para solicitar ediciones en esta entrega.',
  [ERROR_CODES.DELIVERY_EDIT_REQUEST_NOT_FOUND]: 'Solicitud de edición no encontrada.',
} satisfies Record<(typeof ERROR_CODES)[ErrorCodeKey], string>;

const DEFAULT_MESSAGE = 'No pudimos completar la operación.';

interface ZodIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

/**
 * Format a single Zod issue into a human-readable label.
 * "\"variants\",0,\"color\"" → "variante 1 · color"
 */
function formatZodPath(path: (string | number)[]): string {
  const parts = path.map((segment, i) => {
    if (typeof segment === 'number') {
      // Prepend a space and translate; "0" → "1" for end-user display.
      return i === 0 ? String(segment + 1) : ` ${segment + 1}`;
    }
    return i === 0 ? segment : ` · ${segment}`;
  });
  return parts.join('');
}

export function useErrorMessage(
  error: HttpError | null | undefined,
  fallback?: string,
): string | null {
  if (error == null) return null;

  const code = error.code;
  if (code === undefined) return fallback ?? DEFAULT_MESSAGE;

  const base = ERROR_MESSAGES[code] ?? fallback ?? DEFAULT_MESSAGE;

  // For validation errors, append the first Zod issue so the user knows what to fix.
  if (code === ERROR_CODES.VALIDATION_ERROR && Array.isArray(error.details)) {
    const issues = error.details as ZodIssue[];
    if (issues.length > 0) {
      const first = issues[0]!;
      const pathLabel = formatZodPath(first.path);
      return `${base} (${pathLabel}: ${first.message})`;
    }
  }

  return base;
}
